import { test } from "node:test";
import assert from "node:assert/strict";
import { stringToHex } from "viem";
import {
  TOKENS,
  PUSHABLE_TOKENS,
  feedId,
  STRATEGY,
  RISK_LEVEL,
  type TokenSymbol,
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

test("PUSHABLE_TOKENS = exactly the non-static feeds", () => {
  const symbols = PUSHABLE_TOKENS.map((t) => t.symbol).sort();
  assert.deepEqual(symbols, ["USDY", "WMNT", "cmETH", "mETH", "sUSDe"].sort());
  assert.ok(PUSHABLE_TOKENS.every((t) => !t.static && t.feed));
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
