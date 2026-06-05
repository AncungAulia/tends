import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blendedApy,
  computeProjection,
  projectForRisk,
  parseApyOverrides,
} from "../../src/services/projection.js";
import { resolveTargetBps } from "../../src/services/rebalance-math.js";

test("parseApyOverrides: empty / invalid JSON → {}", () => {
  assert.deepEqual(parseApyOverrides(""), {});
  assert.deepEqual(parseApyOverrides("not json"), {});
});

test("parseApyOverrides: keeps known tokens with numeric values, drops the rest", () => {
  assert.deepEqual(
    parseApyOverrides('{"sUSDe":15,"mETH":4,"BOGUS":9,"USDY":"x"}'),
    { sUSDe: 15, mETH: 4 },
  );
});

test("blendedApy: weights per-token APYs by allocation", () => {
  // LOW = 90% mUSD + 10% USDY
  assert.equal(blendedApy(resolveTargetBps(0), { mUSD: 5, USDY: 7 }), 5.2);
});

test("blendedApy: missing APY treated as 0", () => {
  assert.equal(blendedApy(resolveTargetBps(0), { mUSD: 10 }), 9); // USDY missing
});

test("computeProjection: zero APY keeps capital (worst shaves 1%)", () => {
  const p = computeProjection(1000, 365, 0);
  assert.equal(p.base, 1000);
  assert.equal(p.best, 1000);
  assert.equal(p.worst, 990); // ×0.99
});

test("computeProjection: ~5% over a year ≈ +5%", () => {
  const p = computeProjection(1000, 365, 5);
  assert.ok(Math.abs(p.base - 1050) < 0.01, `base ${p.base}`);
});

test("computeProjection: best > base > worst for positive APY", () => {
  const p = computeProjection(1000, 365, 8);
  assert.ok(p.best > p.base, "best > base");
  assert.ok(p.base > p.worst, "base > worst");
  assert.equal(p.blendedApyPct, 8);
});

test("computeProjection: duration 0 → capital unchanged (best/base), worst ×0.99", () => {
  const p = computeProjection(500, 0, 10);
  assert.equal(p.base, 500);
  assert.equal(p.best, 500);
  assert.equal(p.worst, 495);
});

test("computeProjection: rounds to 2 decimals", () => {
  const p = computeProjection(1000, 30, 5);
  assert.equal(Math.round(p.base * 100) / 100, p.base);
});

test("projectForRisk: LOW preset uses blended APY of its basket", () => {
  const p = projectForRisk(0, 1000, 365, { mUSD: 5, USDY: 5 });
  assert.equal(p.blendedApyPct, 5);
  assert.ok(Math.abs(p.base - 1050) < 0.01);
});

test("projectForRisk: CUSTOM blends baskets", () => {
  const p = projectForRisk(3, 1000, 365, { mUSD: 4, USDY: 4, mETH: 4, cmETH: 4, sUSDe: 4, WMNT: 4 }, {
    lowBps: 5000,
    medBps: 5000,
    highBps: 0,
  });
  // every token at 4% → blended 4% regardless of weights (allocation sums to 100%)
  assert.equal(p.blendedApyPct, 4);
});
