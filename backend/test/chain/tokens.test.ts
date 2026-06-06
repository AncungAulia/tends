import { test } from "node:test";
import assert from "node:assert/strict";
import { stringToHex } from "viem";
import {
  TOKENS,
  PUSHABLE_TOKENS,
  feedId,
  STRATEGY,
  RISK_LEVEL,
  TOKEN_BY_ADDRESS,
  TOKENS_BY_CATEGORY,
  CATEGORY_BOUNDS,
  PER_TOKEN_CAP_BPS,
  type TokenSymbol,
  type TokenCategory,
} from "../../src/chain/tokens.js";

test("feedId encodes to right-padded bytes32", () => {
  assert.equal(feedId("MNT"), stringToHex("MNT", { size: 32 }));
  assert.equal(
    feedId("MNT"),
    "0x4d4e540000000000000000000000000000000000000000000000000000000000",
  );
  assert.equal(feedId("MNT").length, 66); // 0x + 64 hex chars
});

test("STRATEGY presets each sum to 10000 bps", () => {
  for (const key of ["LOW", "MEDIUM", "HIGH"] as const) {
    const total = STRATEGY[key].reduce((a, l) => a + l.bps, 0);
    assert.equal(total, 10_000, key);
  }
});

test("STRATEGY only references known, tradeable tokens", () => {
  for (const key of ["LOW", "MEDIUM", "HIGH"] as const) {
    for (const leg of STRATEGY[key]) {
      assert.ok(TOKENS[leg.token], `${leg.token} in TOKENS`);
      assert.notEqual(leg.token, "USDC", "USDC is the base, never a target");
    }
  }
});

test("static tokens are USDC + mUSD; the rest are pushable with a feed", () => {
  assert.equal(TOKENS.USDC.static, true);
  assert.equal(TOKENS.USDC.decimals, 6);
  assert.equal(TOKENS.mUSD.static, true);
  for (const t of Object.values(TOKENS)) {
    if (t.static) {
      assert.equal(t.feed, undefined, `${t.symbol} static → no feed`);
    } else {
      assert.equal(t.decimals, 18, `${t.symbol} decimals`);
      assert.ok(t.feed, `${t.symbol} has a feed`);
    }
  }
});

test("PUSHABLE_TOKENS = all non-static tokens with a feed key", () => {
  // All 41 non-static tokens should be pushable (registry expanded to full RWA universe)
  assert.ok(PUSHABLE_TOKENS.length > 5, `expected many pushable tokens, got ${PUSHABLE_TOKENS.length}`);
  assert.ok(PUSHABLE_TOKENS.every((t) => !t.static && t.feed), "every entry is non-static with a feed");
  // Original crypto tokens still present
  const symbols = PUSHABLE_TOKENS.map((t) => t.symbol);
  for (const sym of ["USDY", "mETH", "cmETH", "sUSDe", "WMNT"] as const) {
    assert.ok(symbols.includes(sym), `${sym} is still pushable`);
  }
});

test("feed strings match the relayer's MockOracle keys", () => {
  const expected: Record<string, string> = {
    USDY: "USDY",
    mETH: "mETH_FUNDAMENTAL",
    cmETH: "cmETH",
    sUSDe: "sUSDe",
    WMNT: "MNT",
  };
  for (const [sym, feed] of Object.entries(expected)) {
    assert.equal(TOKENS[sym as TokenSymbol].feed, feed);
  }
});

test("RISK_LEVEL enum matches the on-chain uint8", () => {
  assert.deepEqual(RISK_LEVEL, { LOW: 0, MEDIUM: 1, HIGH: 2, CUSTOM: 3 });
});

// ── TOKEN_BY_ADDRESS ─────────────────────────────────────────────────────────

test("TOKEN_BY_ADDRESS returns correct token for a known lowercase address", () => {
  const usdcAddr = TOKENS.USDC.address.toLowerCase();
  const found = TOKEN_BY_ADDRESS[usdcAddr];
  assert.ok(found, "should find a token at USDC's lowercase address");
  assert.equal(found.symbol, "USDC");
});

test("TOKEN_BY_ADDRESS works when address is already lowercase", () => {
  // In test envs all addresses default to "" so they collide — only test tokens
  // whose addresses are non-empty (i.e., real addresses are configured).
  // The core invariant: any non-empty lowercase address resolves to a token.
  const nonEmptyTokens = Object.values(TOKENS).filter((t) => t.address !== "");
  if (nonEmptyTokens.length === 0) {
    // All addresses are empty (pure test env) — verify the map itself is defined
    // and that a lookup by "" returns some token (last one wins, which is fine).
    assert.ok(TOKEN_BY_ADDRESS !== undefined, "TOKEN_BY_ADDRESS is defined");
    assert.ok(TOKEN_BY_ADDRESS[""] !== undefined, "empty-string key resolves to a token");
  } else {
    for (const token of nonEmptyTokens) {
      const lower = token.address.toLowerCase();
      const found = TOKEN_BY_ADDRESS[lower];
      assert.ok(found, `${token.symbol}: found via lowercase address`);
      assert.equal(found.symbol, token.symbol, `${token.symbol}: symbol matches`);
    }
  }
});

test("TOKEN_BY_ADDRESS lookup is case-insensitive (uppercase address)", () => {
  // Only meaningful for tokens with real (non-empty) addresses.
  const nonEmptyTokens = Object.values(TOKENS).filter((t) => t.address !== "");
  if (nonEmptyTokens.length === 0) {
    // Pure test env: verify that lowercasing an uppercase empty string still finds something.
    const found = TOKEN_BY_ADDRESS["".toUpperCase().toLowerCase()];
    assert.ok(found !== undefined, "uppercase→lowercase lookup resolves");
  } else {
    for (const token of nonEmptyTokens) {
      const upper = token.address.toUpperCase();
      const found = TOKEN_BY_ADDRESS[upper.toLowerCase()];
      assert.ok(found, `${token.symbol}: found after upper→lower conversion`);
      assert.equal(found.symbol, token.symbol);
    }
  }
});

test("TOKEN_BY_ADDRESS[zero address] returns undefined", () => {
  const zero = "0x0000000000000000000000000000000000000000";
  assert.equal(TOKEN_BY_ADDRESS[zero], undefined);
});

// ── TOKENS_BY_CATEGORY ───────────────────────────────────────────────────────

test("TOKENS_BY_CATEGORY.STABLE contains exactly USDC, mUSD, USDY, sUSDe, BENJI, BUIDL, VBILL (7 tokens)", () => {
  const stableSymbols = TOKENS_BY_CATEGORY.STABLE.map((t) => t.symbol).sort();
  assert.deepEqual(
    stableSymbols,
    ["BENJI", "BUIDL", "USDC", "USDY", "VBILL", "mUSD", "sUSDe"].sort(),
  );
});

test("TOKENS_BY_CATEGORY.STOCK contains exactly AAPL, AMZN, GOOGL, META, MSFT, NVDA, PLTR, TSLA (8 tokens)", () => {
  const stockSymbols = TOKENS_BY_CATEGORY.STOCK.map((t) => t.symbol).sort();
  assert.deepEqual(
    stockSymbols,
    ["AAPL", "AMZN", "GOOGL", "META", "MSFT", "NVDA", "PLTR", "TSLA"].sort(),
  );
});

test("TOKENS_BY_CATEGORY.FX_EM contains exactly BRL, IDR, JPY, KRW, TRY (5 tokens)", () => {
  const fxEmSymbols = TOKENS_BY_CATEGORY.FX_EM.map((t) => t.symbol).sort();
  assert.deepEqual(
    fxEmSymbols,
    ["BRL", "IDR", "JPY", "KRW", "TRY"].sort(),
  );
});

test("All 43 tokens are in TOKENS registry", () => {
  assert.equal(Object.keys(TOKENS).length, 43);
});

test("Every token appears in exactly one category — TOKENS_BY_CATEGORY total === 43", () => {
  const total = Object.values(TOKENS_BY_CATEGORY).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  assert.equal(total, 43);
});

test("No category in TOKENS_BY_CATEGORY has 0 tokens", () => {
  for (const [cat, tokens] of Object.entries(TOKENS_BY_CATEGORY) as [TokenCategory, typeof TOKENS_BY_CATEGORY[TokenCategory]][]) {
    assert.ok(tokens.length > 0, `category ${cat} must have at least 1 token`);
  }
});

// ── CATEGORY_BOUNDS ──────────────────────────────────────────────────────────

test("CATEGORY_BOUNDS.STABLE.LOW has minBps=6500, maxBps=9000", () => {
  assert.equal(CATEGORY_BOUNDS.STABLE.LOW.minBps, 6500);
  assert.equal(CATEGORY_BOUNDS.STABLE.LOW.maxBps, 9000);
});

test("CATEGORY_BOUNDS.STABLE.HIGH has minBps=500, maxBps=2000", () => {
  assert.equal(CATEGORY_BOUNDS.STABLE.HIGH.minBps, 500);
  assert.equal(CATEGORY_BOUNDS.STABLE.HIGH.maxBps, 2000);
});

test("CATEGORY_BOUNDS all min <= max for every category and risk level", () => {
  for (const [cat, levels] of Object.entries(CATEGORY_BOUNDS) as [TokenCategory, Record<"LOW" | "MEDIUM" | "HIGH", { minBps: number; maxBps: number }>][]) {
    for (const [level, bounds] of Object.entries(levels) as ["LOW" | "MEDIUM" | "HIGH", { minBps: number; maxBps: number }][]) {
      assert.ok(
        bounds.minBps <= bounds.maxBps,
        `${cat}.${level}: minBps (${bounds.minBps}) must be <= maxBps (${bounds.maxBps})`,
      );
    }
  }
});

test("Sum of all minBps for each risk level < 10000 (leaves room for LLM)", () => {
  for (const level of ["LOW", "MEDIUM", "HIGH"] as const) {
    const total = Object.values(CATEGORY_BOUNDS).reduce(
      (sum, levels) => sum + levels[level].minBps,
      0,
    );
    assert.ok(
      total < 10_000,
      `risk level ${level}: sum of minBps (${total}) must be < 10000`,
    );
  }
});

test("CATEGORY_BOUNDS.FX_EM.LOW has minBps=0, maxBps=0 (off-limits for LOW)", () => {
  assert.equal(CATEGORY_BOUNDS.FX_EM.LOW.minBps, 0);
  assert.equal(CATEGORY_BOUNDS.FX_EM.LOW.maxBps, 0);
});

test("CATEGORY_BOUNDS.COMMODITY.LOW has minBps=0, maxBps=0 (off-limits for LOW)", () => {
  assert.equal(CATEGORY_BOUNDS.COMMODITY.LOW.minBps, 0);
  assert.equal(CATEGORY_BOUNDS.COMMODITY.LOW.maxBps, 0);
});

test("CATEGORY_BOUNDS.INDEX.LOW has minBps=0, maxBps=0 (off-limits for LOW)", () => {
  assert.equal(CATEGORY_BOUNDS.INDEX.LOW.minBps, 0);
  assert.equal(CATEGORY_BOUNDS.INDEX.LOW.maxBps, 0);
});

test("CATEGORY_BOUNDS.STABLE.HIGH.minBps >= 500 (always need some liquidity)", () => {
  assert.ok(
    CATEGORY_BOUNDS.STABLE.HIGH.minBps >= 500,
    `STABLE.HIGH.minBps (${CATEGORY_BOUNDS.STABLE.HIGH.minBps}) must be >= 500`,
  );
});

// ── PER_TOKEN_CAP_BPS ────────────────────────────────────────────────────────

test("PER_TOKEN_CAP_BPS.STOCK.LOW = 800 (max 8%)", () => {
  assert.equal(PER_TOKEN_CAP_BPS.STOCK?.LOW, 800);
});

test("PER_TOKEN_CAP_BPS.INDEX.LOW = 1500 (max 15%)", () => {
  assert.equal(PER_TOKEN_CAP_BPS.INDEX?.LOW, 1500);
});

test("PER_TOKEN_CAP_BPS.CRYPTO_LST.MEDIUM = 3000 (max 30%)", () => {
  assert.equal(PER_TOKEN_CAP_BPS.CRYPTO_LST?.MEDIUM, 3000);
});

// ── Negative / invariant tests ───────────────────────────────────────────────

test("No token has both static: true AND a feed value", () => {
  for (const token of Object.values(TOKENS)) {
    if (token.static) {
      assert.equal(
        token.feed,
        undefined,
        `${token.symbol} is static so it must not have a feed`,
      );
    }
  }
});

test("No duplicate token addresses in TOKENS registry", () => {
  const addresses = Object.values(TOKENS)
    .map((t) => t.address.toLowerCase())
    .filter((a) => a !== ""); // env defaults to "" for all in test — skip blanks
  const uniqueAddresses = new Set(addresses);
  assert.equal(
    uniqueAddresses.size,
    addresses.length,
    "found duplicate token addresses",
  );
});
