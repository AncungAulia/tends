import {
  CATEGORY_BOUNDS,
  PER_TOKEN_CAP_BPS,
  TOKENS_BY_CATEGORY,
  type TokenCategory,
  type TokenSymbol,
} from "../chain/tokens.js";

// ── Public types ─────────────────────────────────────────────────────────────

export interface HoldingItem {
  symbol: TokenSymbol;
  valueUsd: number;
  /** Current allocation as a percentage (0–100). */
  pct: number;
}

export interface StrategyPromptInput {
  holdings: HoldingItem[];
  totalValueUsd: number;
  /** USD price per token (0 or missing = no live price, skip). */
  prices: Partial<Record<TokenSymbol, number>>;
  /** Annualised APY estimate per token (missing = 0). */
  apy: Partial<Record<TokenSymbol, number>>;
  /** Resolved risk level (CUSTOM already mapped to LOW/MEDIUM/HIGH by caller). */
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  /** User's personal investment policy loaded from AgentConfig.notes. */
  userNotes?: string;
}

// ── System prompt (constant, passed as the `system` message) ─────────────────

export const STRATEGY_SYSTEM_PROMPT = [
  "You are Hermes, the AI portfolio manager for Tends — a tokenized RWA vault on Mantle.",
  "Your job: decide the optimal token allocation given the user's risk preference,",
  "current holdings, live prices, APY estimates, and strategy bounds.",
  "",
  "RULES:",
  "1. Return ONLY valid JSON — no prose, no markdown fences.",
  "2. allocation values are whole integers (percentages). They must sum to EXACTLY 100.",
  "3. MANDATORY: every category whose min% > 0 MUST receive at least that percentage.",
  "   The STRATEGY BOUNDS section shows min%/max% for each category — the min is a HARD FLOOR.",
  "4. Each category's total must also stay AT OR BELOW its max%.",
  "5. No single token may exceed its per-token cap.",
  "6. STABLE category must always be ≥ 5% (needed for swap liquidity).",
  "7. Within a category, prefer higher-APY tokens.",
  "8. Only allocate to tokens EXACTLY as listed — symbols are CASE-SENSITIVE (e.g. 'cmETH' not 'CMETH').",
  "9. 'reasoning' must be 1–2 sentences explaining the key decision.",
  "",
  "STRATEGY: look at MANDATORY MINIMUMS in the prompt first, satisfy those, then distribute the rest.",
  "",
  'Response format: { "reasoning": "...", "allocation": { "TOKEN": <integer>, ... } }',
].join("\n");

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Build the user message sent to Hermes for a strategy decision.
 * The caller appends this to the chat with STRATEGY_SYSTEM_PROMPT as the system message.
 */
export function buildStrategyPrompt(input: StrategyPromptInput): string {
  const { holdings, totalValueUsd, prices, apy, riskLevel, userNotes } = input;

  const lines: string[] = [];

  // ── Portfolio overview ──────────────────────────────────────────────────────
  lines.push("PORTFOLIO");
  lines.push(`Total value: $${totalValueUsd.toFixed(2)} USD`);
  lines.push(`Risk level: ${riskLevel}`);
  lines.push("");

  // ── Current holdings ────────────────────────────────────────────────────────
  lines.push("CURRENT HOLDINGS");
  if (holdings.length === 0) {
    lines.push("- (empty vault)");
  } else {
    for (const h of holdings) {
      lines.push(`- ${h.symbol}: $${h.valueUsd.toFixed(2)} (${h.pct.toFixed(1)}%)`);
    }
  }
  lines.push("");

  const CATEGORY_ORDER: TokenCategory[] = [
    "STABLE", "BOND", "GOLD", "COMMODITY",
    "INDEX", "STOCK", "CRYPTO_LST", "CRYPTO",
    "FX_MAJOR", "FX_EM",
  ];

  // ── Hard constraints (both floors AND ceilings) ──────────────────────────────
  const constrainedCategories = CATEGORY_ORDER.filter((cat) => {
    const b = CATEGORY_BOUNDS[cat][riskLevel];
    return b.minBps > 0 || b.maxBps < 10000;
  });

  lines.push("HARD CONSTRAINTS — ALL are mandatory. Violation = invalid allocation.");
  for (const cat of constrainedCategories) {
    const b = CATEGORY_BOUNDS[cat][riskLevel];
    const minPct = b.minBps / 100;
    const maxPct = b.maxBps / 100;
    const liveToks = TOKENS_BY_CATEGORY[cat].filter((t) => (prices[t.symbol] ?? 0) > 0);
    const examples = liveToks.slice(0, 3).map((t) => t.symbol).join(", ");
    const range = minPct === 0
      ? `max ${maxPct}%`
      : maxPct === 100
      ? `min ${minPct}%`
      : `${minPct}% ≤ total ≤ ${maxPct}%`;
    lines.push(`  ${cat.padEnd(12)} ${range.padEnd(22)} (e.g. ${examples})`);
  }
  lines.push("");

  // ── Strategy bounds + available tokens per category ─────────────────────────
  lines.push(`STRATEGY BOUNDS [${riskLevel}]`);
  lines.push("Format per row: CATEGORY  min%/max%  →  TOKEN($price/APY%) ...");
  lines.push("");

  for (const cat of CATEGORY_ORDER) {
    const bounds = CATEGORY_BOUNDS[cat][riskLevel];
    const minPct = bounds.minBps / 100;
    const maxPct = bounds.maxBps / 100;

    // Tokens in this category that have a live price
    const liveToks = TOKENS_BY_CATEGORY[cat].filter(
      (t) => (prices[t.symbol] ?? 0) > 0,
    );

    if (liveToks.length === 0) {
      lines.push(`${cat.padEnd(12)} ${minPct}%/${maxPct}%  → (no live prices)`);
      continue;
    }

    if (maxPct === 0) {
      lines.push(`${cat.padEnd(12)} ${minPct}%/${maxPct}%  → [off-limits for ${riskLevel}]`);
      continue;
    }

    const tokList = liveToks
      .map((t) => {
        const p = prices[t.symbol]!;
        const a = apy[t.symbol] ?? 0;
        const priceStr = p >= 1000 ? `$${Math.round(p)}` : `$${p.toFixed(p < 0.01 ? 6 : 2)}`;
        return `${t.symbol}(${priceStr}/${a}%)`;
      })
      .join(" ");

    lines.push(`${cat.padEnd(12)} ${String(minPct).padStart(4)}%/${maxPct}%  →  ${tokList}`);
  }
  lines.push("");

  // ── Per-token caps ───────────────────────────────────────────────────────────
  // Show effective cap = min(per-token cap, category max) so LLM sees the binding constraint.
  lines.push("PER-TOKEN CAPS (per individual token — category total must ALSO stay within HARD CONSTRAINTS above)");
  const capParts: string[] = [];
  for (const [cat, byRisk] of Object.entries(PER_TOKEN_CAP_BPS) as [
    TokenCategory,
    Record<"LOW" | "MEDIUM" | "HIGH", number>,
  ][]) {
    const catMaxBps = CATEGORY_BOUNDS[cat][riskLevel].maxBps;
    const effectiveBps = Math.min(byRisk[riskLevel], catMaxBps);
    const capPct = effectiveBps / 100;
    capParts.push(`${cat} max ${capPct}%`);
  }
  lines.push(capParts.join(" | "));
  lines.push("");

  // ── User notes ───────────────────────────────────────────────────────────────
  if (userNotes?.trim()) {
    lines.push("USER INVESTMENT POLICY");
    lines.push(userNotes.trim());
    lines.push("");
  }

  lines.push("Decide the optimal allocation. Return JSON only.");

  return lines.join("\n");
}

// ── Allocation validator ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that Hermes's allocation JSON respects all bounds and caps.
 * Returns { valid: true, errors: [] } on success, or lists every violation.
 */
export function validateAllocation(
  allocation: Record<string, number>,
  prices: Partial<Record<TokenSymbol, number>>,
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
): ValidationResult {
  const errors: string[] = [];

  // 1. Sum must be 100
  const total = Object.values(allocation).reduce((a, b) => a + b, 0);
  if (total !== 100) {
    errors.push(`Allocation sums to ${total}, expected 100`);
  }

  // 2. Category bounds
  const categoryTotals: Partial<Record<TokenCategory, number>> = {};
  for (const [sym, pct] of Object.entries(allocation)) {
    // find category for this token
    for (const [cat, tokens] of Object.entries(TOKENS_BY_CATEGORY) as [TokenCategory, typeof TOKENS_BY_CATEGORY[TokenCategory]][]) {
      if (tokens.some((t) => t.symbol === sym)) {
        categoryTotals[cat] = (categoryTotals[cat] ?? 0) + pct;
        break;
      }
    }
  }

  for (const cat of Object.keys(CATEGORY_BOUNDS) as TokenCategory[]) {
    const { minBps, maxBps } = CATEGORY_BOUNDS[cat][riskLevel];
    const actual = categoryTotals[cat] ?? 0;
    const minPct = minBps / 100;
    const maxPct = maxBps / 100;
    if (actual < minPct) errors.push(`${cat} total ${actual}% is below minimum ${minPct}%`);
    if (actual > maxPct) errors.push(`${cat} total ${actual}% exceeds maximum ${maxPct}%`);
  }

  // 3. Per-token caps
  for (const [sym, pct] of Object.entries(allocation)) {
    for (const [cat, capByRisk] of Object.entries(PER_TOKEN_CAP_BPS) as [
      TokenCategory,
      Record<"LOW" | "MEDIUM" | "HIGH", number>,
    ][]) {
      const inCat = TOKENS_BY_CATEGORY[cat].some((t) => t.symbol === sym);
      if (!inCat) continue;
      const capPct = capByRisk[riskLevel] / 100;
      if (pct > capPct) {
        errors.push(`${sym} allocation ${pct}% exceeds per-token cap ${capPct}%`);
      }
      break;
    }
  }

  // 4. Only known tokens with live prices
  for (const sym of Object.keys(allocation)) {
    if ((prices[sym as TokenSymbol] ?? 0) === 0 && allocation[sym]! > 0) {
      errors.push(`${sym} has no live price but is allocated ${allocation[sym]}%`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Allocation repairer ───────────────────────────────────────────────────────

/**
 * Best-effort repair of an LLM allocation before validation.
 * Handles: category ceiling violations (proportional scale-down),
 * per-token cap violations (hard cap), sum ≠ 100 (adjust via STABLE buffer),
 * and category floor deficits (fill from largest STABLE token).
 * Returns repaired allocation; caller must still run validateAllocation.
 */
export function repairAllocation(
  raw: Record<string, number>,
  prices: Partial<Record<TokenSymbol, number>>,
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
): Record<string, number> {
  // Build token→category lookup
  const tokenCat = new Map<string, TokenCategory>();
  for (const [cat, tokens] of Object.entries(TOKENS_BY_CATEGORY) as [TokenCategory, { symbol: TokenSymbol }[]][]) {
    for (const t of tokens) tokenCat.set(t.symbol, cat);
  }

  // 1. Remove zero / no-live-price entries
  const alloc: Record<string, number> = {};
  for (const [sym, pct] of Object.entries(raw)) {
    if (pct > 0 && (prices[sym as TokenSymbol] ?? 0) > 0) {
      alloc[sym] = pct;
    }
  }

  // 2. Cap each token to effective cap = min(per-token cap, category max)
  for (const [sym, pct] of Object.entries(alloc)) {
    const cat = tokenCat.get(sym);
    if (!cat) continue;
    const catMaxPct = CATEGORY_BOUNDS[cat][riskLevel].maxBps / 100;
    const rawTokenCap = PER_TOKEN_CAP_BPS[cat]?.[riskLevel];
    const tokenCapPct = rawTokenCap != null ? rawTokenCap / 100 : catMaxPct;
    const effectiveCap = Math.min(catMaxPct, tokenCapPct);
    if (pct > effectiveCap) alloc[sym] = effectiveCap;
  }

  // 3. Cap each category to its max (proportional scale-down within category)
  for (const cat of Object.keys(CATEGORY_BOUNDS) as TokenCategory[]) {
    const maxPct = CATEGORY_BOUNDS[cat][riskLevel].maxBps / 100;
    if (maxPct >= 100) continue;
    const catSyms = Object.keys(alloc).filter((s) => tokenCat.get(s) === cat);
    const catTotal = catSyms.reduce((s, k) => s + alloc[k]!, 0);
    if (catTotal > maxPct && catTotal > 0) {
      const scale = maxPct / catTotal;
      for (const sym of catSyms) {
        alloc[sym] = Math.floor(alloc[sym]! * scale);
      }
    }
  }

  // 4. Normalise sum to 100 — find a token whose category has room for ±diff
  const getCatTotal = (cat: TokenCategory) =>
    Object.keys(alloc).filter((s) => tokenCat.get(s) === cat).reduce((s, k) => s + (alloc[k] ?? 0), 0);

  const adjustSum = () => {
    const diff = 100 - Object.values(alloc).reduce((s, v) => s + v, 0);
    if (diff === 0) return;

    const sorted = Object.entries(alloc).sort(([, a], [, b]) => b - a);
    for (const [sym] of sorted) {
      const cat = tokenCat.get(sym);
      if (!cat) continue;
      const catMax = CATEGORY_BOUNDS[cat][riskLevel].maxBps / 100;
      const catMin = CATEGORY_BOUNDS[cat][riskLevel].minBps / 100;
      const newCatTotal = getCatTotal(cat) + diff;
      const newTokenVal = (alloc[sym] ?? 0) + diff;
      if (newTokenVal >= 0 && newCatTotal >= catMin && newCatTotal <= catMax) {
        alloc[sym] = newTokenVal;
        return;
      }
    }
    // No perfect slot — clamp to largest token as last resort
    const [largest] = sorted;
    if (largest) alloc[largest[0]] = Math.max(0, (alloc[largest[0]] ?? 0) + diff);
  };

  adjustSum();

  // 5. Fill category floors (take from largest STABLE token, then any token)
  for (const cat of Object.keys(CATEGORY_BOUNDS) as TokenCategory[]) {
    const minPct = CATEGORY_BOUNDS[cat][riskLevel].minBps / 100;
    if (minPct === 0) continue;
    const catSyms = Object.keys(alloc).filter((s) => tokenCat.get(s) === cat);
    const catTotal = catSyms.reduce((s, k) => s + alloc[k]!, 0);
    if (catTotal >= minPct) continue;

    const deficit = minPct - catTotal;
    const liveToks = TOKENS_BY_CATEGORY[cat].filter((t) => (prices[t.symbol] ?? 0) > 0);
    if (liveToks.length === 0) continue;

    const firstTok = liveToks[0];
    if (!firstTok) continue;
    const target = firstTok.symbol;
    alloc[target] = (alloc[target] ?? 0) + deficit;

    // Take deficit from STABLE first, then any non-target token
    let rem = deficit;
    const donors = Object.entries(alloc)
      .filter(([s]) => s !== target)
      .sort(([sa, a], [sb, b]) => {
        const pa = tokenCat.get(sa) === "STABLE" ? 1 : 0;
        const pb = tokenCat.get(sb) === "STABLE" ? 1 : 0;
        return pb - pa || b - a;
      });

    for (const [sym] of donors) {
      const take = Math.min(alloc[sym]!, rem);
      alloc[sym] = alloc[sym]! - take;
      rem -= take;
      if (rem <= 0) break;
    }
  }

  // Final sum correction (rounding dust)
  adjustSum();

  return Object.fromEntries(Object.entries(alloc).filter(([, v]) => v > 0));
}
