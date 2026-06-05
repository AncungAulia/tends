import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTargetToCaps, driftFloorWad } from "../../src/services/rebalance-math.js";
import type { TokenSymbol } from "../../src/chain/tokens.js";

const m = (o: Partial<Record<TokenSymbol, number>>): Map<TokenSymbol, number> =>
  new Map(Object.entries(o) as [TokenSymbol, number][]);

const sum = (map: Map<TokenSymbol, number>): number => [...map.values()].reduce((a, b) => a + b, 0);

test("clampTargetToCaps: no caps breached → unchanged", () => {
  const t = m({ cmETH: 4000, sUSDe: 3000, mETH: 2000, WMNT: 1000 });
  assert.deepEqual(clampTargetToCaps(t, { sUSDe: 5000 }), t);
});

test("clampTargetToCaps: caps a token and redistributes the excess to others", () => {
  const t = m({ cmETH: 4000, sUSDe: 3000, mETH: 2000, WMNT: 1000 }); // sums 10000
  const out = clampTargetToCaps(t, { sUSDe: 1000 }); // cap sUSDe at 10%
  assert.equal(out.get("sUSDe"), 1000); // clamped from 3000
  assert.equal(sum(out), 10_000); // total preserved (excess redistributed exactly)
  // the 2000 excess lands on uncapped tokens (most headroom first → WMNT)
  assert.ok((out.get("WMNT") ?? 0) > 1000);
  for (const [, bps] of out) assert.ok(bps <= 10_000); // nothing exceeds its bound
});

test("clampTargetToCaps: all-saturated excess falls through (total < 10000 → USDC implicit)", () => {
  const t = m({ cmETH: 6000, sUSDe: 4000 });
  const out = clampTargetToCaps(t, { cmETH: 2000, sUSDe: 2000 }); // both capped at 20%
  assert.equal(out.get("cmETH"), 2000);
  assert.equal(out.get("sUSDe"), 2000);
  assert.equal(sum(out), 4000); // 6000 excess can't fit → drops to USDC
});

test("driftFloorWad: bps of portfolio as an 18-dec USD floor", () => {
  const E18 = 10n ** 18n;
  assert.equal(driftFloorWad(250, 1000n * E18), 25n * E18); // 2.5% of $1000 = $25
  assert.equal(driftFloorWad(0, 1000n * E18), 0n);
});

// ── maxPerAssetPct merge tests (simulates defaultBuildInstructions logic) ─────

test("maxPerAssetPct: global 25% cap clamps tokens over 2500 bps", () => {
  // Simulates: maxPerAssetPct=25 → globalCapBps=2500, no perTokenCaps
  const target = m({ cmETH: 4000, sUSDe: 3000, mETH: 2000, WMNT: 1000 });
  const globalCap = 2500;
  const effectiveCaps: Partial<Record<TokenSymbol, number>> = {
    cmETH: globalCap, sUSDe: globalCap, mETH: globalCap, WMNT: globalCap,
  };
  const out = clampTargetToCaps(target, effectiveCaps);
  assert.ok((out.get("cmETH") ?? 0) <= 2500, "cmETH clamped from 4000");
  assert.ok((out.get("sUSDe") ?? 0) <= 2500, "sUSDe clamped from 3000");
  assert.ok((out.get("mETH") ?? 0) <= 2500,  "mETH unchanged (was 2000)");
  assert.ok((out.get("WMNT") ?? 0) <= 2500,  "WMNT unchanged (was 1000)");
});

test("maxPerAssetPct: per-token cap takes precedence when stricter than global", () => {
  // globalCap = 2500, but sUSDe has per-token cap of 1500 → effective = min(2500,1500)=1500
  const target = m({ cmETH: 4000, sUSDe: 3000, mETH: 2000, WMNT: 1000 });
  const effectiveCaps: Partial<Record<TokenSymbol, number>> = {
    cmETH: 2500,
    sUSDe: 1500, // min(2500, 1500)
    mETH: 2500,
    WMNT: 2500,
  };
  const out = clampTargetToCaps(target, effectiveCaps);
  assert.ok((out.get("sUSDe") ?? 0) <= 1500, "sUSDe respects stricter per-token cap");
  assert.ok((out.get("cmETH") ?? 0) <= 2500, "cmETH respects global cap");
});

test("maxPerAssetPct: global cap overrides loose per-token cap", () => {
  // globalCap = 2000, perToken sUSDe = 4000 → effective = min(4000, 2000) = 2000
  const target = m({ cmETH: 4000, sUSDe: 3500, mETH: 2000, WMNT: 500 });
  const effectiveCaps: Partial<Record<TokenSymbol, number>> = {
    cmETH: 2000,
    sUSDe: 2000, // min(4000, 2000) = 2000
    mETH: 2000,
    WMNT: 2000,
  };
  const out = clampTargetToCaps(target, effectiveCaps);
  assert.ok((out.get("cmETH") ?? 0) <= 2000);
  assert.ok((out.get("sUSDe") ?? 0) <= 2000);
});
