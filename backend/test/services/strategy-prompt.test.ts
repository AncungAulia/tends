import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStrategyPrompt,
  validateAllocation,
  STRATEGY_SYSTEM_PROMPT,
  type StrategyPromptInput,
} from "../../src/services/strategy-prompt.js";

const PRICES = {
  USDC: 1, mUSD: 1, USDY: 1.14, sUSDe: 1.23, BENJI: 1, BUIDL: 1, VBILL: 1,
  CETES: 0.067, GILTS: 1.41, TESOURO: 0.23,
  XAU: 4328, XAUt: 4294, XAG: 67.8, XPT: 1781,
  WTI: 89.2, XCU: 6.2, URANIUM: 85.4,
  USA500: 7363, USA100: 28856, KOSPI200: 1299, NIKKEI225: 63838,
  AAPL: 308, AMZN: 246, GOOGL: 369, META: 593, MSFT: 417, NVDA: 205, PLTR: 136, TSLA: 391,
  mETH: 1684, cmETH: 1684, WMNT: 0.51,
  EUR: 1.15, GBP: 1.33, SGD: 0.77,
  BRL: 0.19, IDR: 0.000055, JPY: 0.0062, KRW: 0.00064, TRY: 0.022,
} as const;

const APY = {
  mUSD: 4.5, USDY: 5, sUSDe: 14, BENJI: 5, VBILL: 5,
  CETES: 9.5, GILTS: 4.5, TESOURO: 6,
  XAU: 0, XAG: 0, USA500: 8, AAPL: 8, MSFT: 10, NVDA: 20,
  mETH: 4, cmETH: 8, WMNT: 5, EUR: 0,
} as const;

const makeInput = (
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
  overrides: Partial<StrategyPromptInput> = {},
): StrategyPromptInput => ({
  holdings: [{ symbol: "USDC", valueUsd: 895, pct: 100 }],
  totalValueUsd: 895,
  prices: PRICES,
  apy: APY,
  riskLevel,
  ...overrides,
});

// ── STRATEGY_SYSTEM_PROMPT ───────────────────────────────────────────────────

test("STRATEGY_SYSTEM_PROMPT includes all required rules", () => {
  assert.ok(STRATEGY_SYSTEM_PROMPT.includes("sum to EXACTLY 100"));
  assert.ok(STRATEGY_SYSTEM_PROMPT.includes("STABLE category must always be ≥ 5%"));
  assert.ok(STRATEGY_SYSTEM_PROMPT.includes("reasoning"));
  assert.ok(STRATEGY_SYSTEM_PROMPT.includes("allocation"));
});

// ── buildStrategyPrompt ──────────────────────────────────────────────────────

test("buildStrategyPrompt: includes risk level and total value", () => {
  const p = buildStrategyPrompt(makeInput("LOW"));
  assert.ok(p.includes("LOW"));
  assert.ok(p.includes("895.00"));
});

test("buildStrategyPrompt: shows current holdings", () => {
  const p = buildStrategyPrompt(makeInput("LOW"));
  assert.ok(p.includes("USDC: $895.00 (100.0%)"));
});

test("buildStrategyPrompt: includes STABLE bounds for LOW (65%/90%)", () => {
  const p = buildStrategyPrompt(makeInput("LOW"));
  assert.ok(p.includes("65%/90%"), `prompt missing STABLE LOW bounds:\n${p}`);
});

test("buildStrategyPrompt: marks off-limits categories for LOW", () => {
  const p = buildStrategyPrompt(makeInput("LOW"));
  assert.ok(p.includes("off-limits"), "COMMODITY/INDEX/FX_EM should be off-limits for LOW");
});

test("buildStrategyPrompt: includes per-token caps", () => {
  const p = buildStrategyPrompt(makeInput("MEDIUM"));
  assert.ok(p.includes("PER-TOKEN CAPS"));
  assert.ok(p.includes("STOCK max 8%"));
});

test("buildStrategyPrompt: includes user notes when provided", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { userNotes: "Recover to $1000 first" }));
  assert.ok(p.includes("USER INVESTMENT POLICY"));
  assert.ok(p.includes("Recover to $1000 first"));
});

test("buildStrategyPrompt: omits user notes section when empty", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { userNotes: "" }));
  assert.ok(!p.includes("USER INVESTMENT POLICY"));
});

test("buildStrategyPrompt: tokens with no live price are skipped", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { prices: { USDC: 1, mUSD: 1 } }));
  // Tokens without price should not appear in available list
  assert.ok(!p.includes("NVDA("), "NVDA has no price → not shown");
});

test("buildStrategyPrompt: HIGH shows STOCK, INDEX, COMMODITY categories", () => {
  const p = buildStrategyPrompt(makeInput("HIGH"));
  assert.ok(p.includes("STOCK"), "HIGH should have STOCK");
  assert.ok(p.includes("INDEX"), "HIGH should have INDEX");
  assert.ok(p.includes("COMMODITY"), "HIGH should have COMMODITY");
  // Should NOT be off-limits for HIGH
  assert.ok(!p.includes("[off-limits for HIGH]"), "no categories off-limits for HIGH");
});

test("buildStrategyPrompt: empty holdings shows placeholder", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { holdings: [], totalValueUsd: 0 }));
  assert.ok(p.includes("empty vault"));
});

// ── validateAllocation ───────────────────────────────────────────────────────

test("validateAllocation: valid LOW allocation passes", () => {
  const alloc = { mUSD: 75, CETES: 15, XAU: 5, sUSDe: 5 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(r.valid, `Expected valid, got errors: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: sum ≠ 100 fails", () => {
  const alloc = { mUSD: 80, CETES: 10 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => e.includes("sums to 90")));
});

test("validateAllocation: STABLE below minimum for LOW fails", () => {
  // STABLE < 65% for LOW
  const alloc = { mUSD: 50, CETES: 25, XAU: 10, mETH: 5, WMNT: 3, AAPL: 7 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => e.includes("STABLE") && e.includes("below minimum")));
});

test("validateAllocation: STABLE above maximum for LOW fails", () => {
  // STABLE > 90% for LOW
  const alloc = { mUSD: 95, CETES: 5 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => e.includes("STABLE") && e.includes("exceeds maximum")));
});

test("validateAllocation: per-token cap exceeded fails", () => {
  // NVDA > 8% (STOCK cap)
  const alloc = { sUSDe: 10, CETES: 5, USA500: 15, NVDA: 10, TSLA: 8, META: 6, MSFT: 6, mETH: 15, cmETH: 12, WMNT: 5, XAG: 5, WTI: 3 };
  const r = validateAllocation(alloc, PRICES, "HIGH");
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => e.includes("NVDA") && e.includes("cap")));
});

test("validateAllocation: token with no price but allocated fails", () => {
  const alloc = { mUSD: 90, USDY: 10 };
  const r = validateAllocation(alloc, { mUSD: 1 }, "LOW"); // USDY has no price
  assert.ok(!r.valid);
  assert.ok(r.errors.some((e) => e.includes("USDY") && e.includes("no live price")));
});

test("validateAllocation: valid HIGH allocation passes", () => {
  const alloc = {
    sUSDe: 12, CETES: 5, XAG: 5, WTI: 5,
    USA500: 15, NVDA: 8, TSLA: 8, META: 6, MSFT: 6,
    mETH: 12, cmETH: 11, WMNT: 7,
  };
  const r = validateAllocation(alloc, PRICES, "HIGH");
  assert.ok(r.valid, `Expected valid, got errors: ${r.errors.join(", ")}`);
});

// ── buildStrategyPrompt — POSITIVE (new) ─────────────────────────────────────

test("buildStrategyPrompt: multiple holdings shown correctly", () => {
  const p = buildStrategyPrompt(makeInput("LOW", {
    holdings: [
      { symbol: "mUSD",  valueUsd: 600, pct: 60.3 },
      { symbol: "CETES", valueUsd: 295, pct: 29.6 },
      { symbol: "XAU",   valueUsd: 100, pct: 10.1 },
    ],
    totalValueUsd: 995,
  }));
  assert.ok(p.includes("mUSD: $600.00 (60.3%)"),  "mUSD holding not found");
  assert.ok(p.includes("CETES: $295.00 (29.6%)"), "CETES holding not found");
  assert.ok(p.includes("XAU: $100.00 (10.1%)"),   "XAU holding not found");
});

test("buildStrategyPrompt: holdings percentage rounds to 1 decimal", () => {
  const p = buildStrategyPrompt(makeInput("LOW", {
    holdings: [
      { symbol: "mUSD",  valueUsd: 333.33, pct: 33.333 },
      { symbol: "CETES", valueUsd: 333.33, pct: 33.333 },
      { symbol: "XAU",   valueUsd: 333.34, pct: 33.334 },
    ],
    totalValueUsd: 1000,
  }));
  // 33.333 and 33.334 both round to 33.3 at 1 decimal place
  const matches = (p.match(/\(33\.3%\)/g) ?? []).length;
  assert.equal(matches, 3, `Expected three '(33.3%)' entries, found ${matches}`);
});

test("buildStrategyPrompt: MEDIUM risk shows INDEX bounds 5%/20%", () => {
  const p = buildStrategyPrompt(makeInput("MEDIUM", { prices: { USA500: 7363 } }));
  assert.ok(p.includes("INDEX"), "INDEX category not found");
  // INDEX MEDIUM: minBps=500 → 5%, maxBps=2000 → 20%
  const idx = p.indexOf("INDEX");
  const line = p.substring(idx, idx + 60);
  assert.ok(line.includes("5%/20%"), `INDEX line should show 5%/20%: ${line}`);
});

test("buildStrategyPrompt: MEDIUM risk shows COMMODITY bounds 0%/8%", () => {
  const p = buildStrategyPrompt(makeInput("MEDIUM", { prices: { WTI: 89.2 } }));
  assert.ok(p.includes("COMMODITY"), "COMMODITY category not found");
  // COMMODITY MEDIUM: minBps=0 → 0%, maxBps=800 → 8%
  const idx = p.indexOf("COMMODITY");
  const line = p.substring(idx, idx + 60);
  assert.ok(line.includes("0%/8%"), `COMMODITY line should show 0%/8%: ${line}`);
});

test("buildStrategyPrompt: prompt ends with 'Decide the optimal allocation. Return JSON only.'", () => {
  const p = buildStrategyPrompt(makeInput("LOW"));
  assert.ok(
    p.endsWith("Decide the optimal allocation. Return JSON only."),
    "Prompt does not end with the expected closing instruction",
  );
});

test("buildStrategyPrompt: APY shown inline — mUSD($1.00/4.5%) appears in LOW prompt", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { prices: { mUSD: 1 }, apy: { mUSD: 4.5 } }));
  assert.ok(p.includes("mUSD($1.00/4.5%)"), `Expected mUSD($1.00/4.5%) in prompt:\n${p}`);
});

test("buildStrategyPrompt: tokens with APY=0 show '0%' correctly (e.g. XAU)", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { prices: { mUSD: 1, XAU: 4328 }, apy: { mUSD: 4.5, XAU: 0 } }));
  assert.ok(p.includes("XAU($4328/0%)"), `Expected XAU($4328/0%) in prompt:\n${p}`);
});

// ── buildStrategyPrompt — NEGATIVE (new) ─────────────────────────────────────

test("buildStrategyPrompt: userNotes with only whitespace → section not shown", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { userNotes: "   \n  " }));
  assert.ok(!p.includes("USER INVESTMENT POLICY"), "Whitespace-only notes should not render the section");
});

// ── buildStrategyPrompt — EDGE CASES (new) ───────────────────────────────────

test("buildStrategyPrompt: very small price (IDR ~0.000055) formatted as '$0.000055'", () => {
  const p = buildStrategyPrompt(makeInput("MEDIUM", { prices: { IDR: 0.000055 } }));
  assert.ok(p.includes("IDR($0.000055/"), `Expected IDR($0.000055/... in prompt:\n${p}`);
});

test("buildStrategyPrompt: very large price (NIKKEI225 ~63838) formatted without decimals '$63838'", () => {
  const p = buildStrategyPrompt(makeInput("MEDIUM", { prices: { NIKKEI225: 63838 } }));
  assert.ok(p.includes("NIKKEI225($63838/"), `Expected NIKKEI225($63838/... in prompt:\n${p}`);
});

test("buildStrategyPrompt: token with price>0 but APY missing from map → shows '0%' not error", () => {
  // USDC is in STABLE, has price, but no APY entry
  const p = buildStrategyPrompt(makeInput("LOW", { prices: { USDC: 1 }, apy: {} }));
  assert.ok(p.includes("USDC($1.00/0%)"), `Expected USDC($1.00/0%) in prompt:\n${p}`);
});

test("buildStrategyPrompt: all prices = 0 → categories show '(no live prices)'", () => {
  const p = buildStrategyPrompt(makeInput("LOW", { prices: {}, apy: {} }));
  assert.ok(p.includes("(no live prices)"), "Expected '(no live prices)' when all prices are zero/missing");
  // Verify it appears for multiple categories
  const occurrences = (p.match(/\(no live prices\)/g) ?? []).length;
  assert.ok(occurrences >= 3, `Expected at least 3 'no live prices' entries, found ${occurrences}`);
});

// ── validateAllocation — POSITIVE boundary (new) ────────────────────────────

test("validateAllocation: STABLE exactly at minimum (65%) → valid for LOW", () => {
  // mUSD:65, CETES:25, XAU:10 — sum=100, STABLE=65%=min, BOND=25%=max, GOLD=10%=max
  const alloc = { mUSD: 65, CETES: 25, XAU: 10 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(r.valid, `Expected valid at STABLE boundary min, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: STABLE exactly at maximum (90%) → valid for LOW", () => {
  // mUSD:90, CETES:10 — sum=100, STABLE=90%=max, BOND=10% (5-25%)
  const alloc = { mUSD: 90, CETES: 10 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(r.valid, `Expected valid at STABLE boundary max, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: STOCK allocation exactly at cap (8%) → valid for HIGH", () => {
  // sUSDe:8, CETES:5, GILTS:5, USA500:15, AAPL:8, MSFT:7, TSLA:7, mETH:13, cmETH:10, WMNT:8, XAU:5, WTI:9
  // AAPL=8% exactly at STOCK per-token cap of 8%
  const alloc = { sUSDe: 8, CETES: 5, GILTS: 5, USA500: 15, AAPL: 8, MSFT: 7, TSLA: 7, mETH: 13, cmETH: 10, WMNT: 8, XAU: 5, WTI: 9 };
  const r = validateAllocation(alloc, PRICES, "HIGH");
  assert.ok(r.valid, `Expected valid with STOCK at cap, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: INDEX exactly at cap (15%) → valid for HIGH", () => {
  // Same alloc — USA500=15% is exactly at INDEX per-token cap of 15%
  const alloc = { sUSDe: 8, CETES: 5, GILTS: 5, USA500: 15, AAPL: 8, MSFT: 7, TSLA: 7, mETH: 13, cmETH: 10, WMNT: 8, XAU: 5, WTI: 9 };
  const r = validateAllocation(alloc, PRICES, "HIGH");
  assert.ok(r.valid, `Expected valid with INDEX at cap, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: valid MEDIUM allocation passes", () => {
  // mUSD:35, sUSDe:10, CETES:10, GILTS:5, USA500:10, AAPL:5, MSFT:5, mETH:10, cmETH:5, WMNT:5 — sum=100
  // STABLE=45%(25-50%)✓ BOND=15%(5-20%)✓ INDEX=10%(5-20%)✓ STOCK=10%(5-20%)✓ CRYPTO_LST=15%(5-15%)✓ CRYPTO=5%(2-8%)✓
  const alloc = { mUSD: 35, sUSDe: 10, CETES: 10, GILTS: 5, USA500: 10, AAPL: 5, MSFT: 5, mETH: 10, cmETH: 5, WMNT: 5 };
  const r = validateAllocation(alloc, PRICES, "MEDIUM");
  assert.ok(r.valid, `Expected valid MEDIUM allocation, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

// ── validateAllocation — NEGATIVE (new) ──────────────────────────────────────

test("validateAllocation: STABLE exactly 1% below minimum (64%) → invalid for LOW", () => {
  // mUSD:64, CETES:15, GILTS:10, XAU:8, mETH:3 — sum=100, STABLE=64% < 65%
  const alloc = { mUSD: 64, CETES: 15, GILTS: 10, XAU: 8, mETH: 3 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("STABLE") && e.includes("below minimum")),
    `Expected STABLE below minimum error, got: ${r.errors.join(", ")}`,
  );
});

test("validateAllocation: STABLE exactly 1% above maximum (91%) → invalid for LOW", () => {
  // mUSD:91, CETES:9 — sum=100, STABLE=91% > 90%
  const alloc = { mUSD: 91, CETES: 9 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("STABLE") && e.includes("exceeds maximum")),
    `Expected STABLE exceeds maximum error, got: ${r.errors.join(", ")}`,
  );
});

test("validateAllocation: BOND above maximum for LOW (26% when max=25%) → invalid", () => {
  // mUSD:65, CETES:13, GILTS:13, XAU:9 — sum=100, BOND=26% > 25%
  const alloc = { mUSD: 65, CETES: 13, GILTS: 13, XAU: 9 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("BOND") && e.includes("exceeds maximum")),
    `Expected BOND exceeds maximum error, got: ${r.errors.join(", ")}`,
  );
});

test("validateAllocation: sum = 0 (empty allocation {}) → invalid", () => {
  const r = validateAllocation({}, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("sums to 0")),
    `Expected sum=0 error, got: ${r.errors.join(", ")}`,
  );
});

test("validateAllocation: sum = 101 → invalid", () => {
  // mUSD:91, CETES:10 — sum=101
  const r = validateAllocation({ mUSD: 91, CETES: 10 }, PRICES, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("sums to 101")),
    `Expected sum=101 error, got: ${r.errors.join(", ")}`,
  );
});

test("validateAllocation: multiple simultaneous errors are all returned", () => {
  // mUSD:50, CETES:45, NVDA:5 — sum=100 but STABLE=50<65, BOND=45>25, NVDA has no price
  const alloc = { mUSD: 50, CETES: 45, NVDA: 5 };
  const prices = { mUSD: 1, CETES: 0.067 }; // NVDA has no price
  const r = validateAllocation(alloc, prices, "LOW");
  assert.ok(!r.valid);
  assert.ok(
    r.errors.some((e) => e.includes("STABLE") && e.includes("below minimum")),
    "Expected STABLE below minimum error",
  );
  assert.ok(
    r.errors.some((e) => e.includes("BOND") && e.includes("exceeds maximum")),
    "Expected BOND exceeds maximum error",
  );
  assert.ok(
    r.errors.some((e) => e.includes("NVDA") && e.includes("no live price")),
    "Expected NVDA no live price error",
  );
  assert.ok(r.errors.length >= 3, `Expected at least 3 errors, got ${r.errors.length}`);
});

// ── validateAllocation — EDGE CASES (new) ────────────────────────────────────

test("validateAllocation: token with 0% allocation does not cause errors", () => {
  // mUSD:80, USDY:10, CETES:10, WMNT:0 — WMNT at 0% adds nothing to CRYPTO total
  const alloc = { mUSD: 80, USDY: 10, CETES: 10, WMNT: 0 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(r.valid, `Expected valid with 0% WMNT, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: USDC as STABLE target is valid for LOW", () => {
  // USDC:70, CETES:20, XAU:10 — sum=100, STABLE=70%(65-90%)✓, BOND=20%(5-25%)✓, GOLD=10%(0-10%)✓
  const alloc = { USDC: 70, CETES: 20, XAU: 10 };
  const r = validateAllocation(alloc, PRICES, "LOW");
  assert.ok(r.valid, `Expected valid with USDC in STABLE, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});

test("validateAllocation: unknown token symbol with 0% passes sum check", () => {
  // mUSD:65, CETES:25, XAU:10, FAKECOIN:0 — sum=100
  // FAKECOIN has no category match so doesn't affect category totals
  // FAKECOIN:0 means no 'no live price' error is triggered (pct=0 skips price check)
  const alloc: Record<string, number> = { mUSD: 65, CETES: 25, XAU: 10, FAKECOIN: 0 };
  const prices = { ...PRICES, FAKECOIN: 0 } as typeof PRICES;
  const r = validateAllocation(alloc, prices, "LOW");
  // Sum=100 ✓, STABLE=65%=min ✓, BOND=25%=max ✓, GOLD=10%=max ✓
  assert.ok(r.valid, `Expected valid, got: ${r.errors.join(", ")}`);
  assert.equal(r.errors.length, 0);
});
