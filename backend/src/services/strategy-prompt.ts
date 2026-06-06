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
  "3. Each category's total must stay within the given [min%, max%] bounds.",
  "4. No single token may exceed its per-token cap.",
  "5. STABLE category must always be ≥ 5% (needed for swap liquidity).",
  "6. Within a category, prefer higher-APY tokens.",
  "7. Only allocate to tokens listed in AVAILABLE TOKENS — no others.",
  "8. 'reasoning' must be 1–2 sentences explaining the key decision.",
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

  // ── Strategy bounds + available tokens per category ─────────────────────────
  lines.push(`STRATEGY BOUNDS [${riskLevel}]`);
  lines.push("Format per row: CATEGORY  min%/max%  →  TOKEN($price/APY%) ...");
  lines.push("");

  const CATEGORY_ORDER: TokenCategory[] = [
    "STABLE", "BOND", "GOLD", "COMMODITY",
    "INDEX", "STOCK", "CRYPTO_LST", "CRYPTO",
    "FX_MAJOR", "FX_EM",
  ];

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
  lines.push("PER-TOKEN CAPS");
  const capParts: string[] = [];
  for (const [cat, byRisk] of Object.entries(PER_TOKEN_CAP_BPS) as [
    TokenCategory,
    Record<"LOW" | "MEDIUM" | "HIGH", number>,
  ][]) {
    const capPct = byRisk[riskLevel] / 100;
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
