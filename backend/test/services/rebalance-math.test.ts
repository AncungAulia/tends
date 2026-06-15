import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSwapInstructions,
  resolveTargetBps,
  applyAllocationCaps,
  tokensOutOfBand,
  valueUsd,
  type TokenState,
} from "../../src/services/rebalance-math.js";
import type { TokenSymbol } from "../../src/chain/tokens.js";

const E18 = 10n ** 18n;
const A = {
  USDC: "0x00000000000000000000000000000000000000c1" as const,
  mUSD: "0x00000000000000000000000000000000000000c2" as const,
  USDY: "0x00000000000000000000000000000000000000c3" as const,
  mETH: "0x00000000000000000000000000000000000000c4" as const,
  cmETH: "0x00000000000000000000000000000000000000c5" as const,
};

// Explicit simple allocation maps for behavioral tests — independent of STRATEGY changes.
const SIMPLE_LOW = new Map<TokenSymbol, number>([["mUSD", 9000], ["USDY", 1000]]);
const SIMPLE_MED = new Map<TokenSymbol, number>([["mUSD", 4000], ["mETH", 3000], ["cmETH", 3000]]);

/** Build a token state with sane defaults (prices in 18-dec USD). */
const usdc = (balance: bigint): TokenState => ({
  symbol: "USDC",
  address: A.USDC,
  decimals: 6,
  balance,
  price: E18,
});
const tok = (
  symbol: "mUSD" | "USDY" | "mETH" | "cmETH",
  balance: bigint,
  price: bigint,
): TokenState => ({ symbol, address: A[symbol], decimals: 18, balance, price });

const CFG = { slippageBps: 100, minSwapValueUsd: E18 };

test("fresh USDC deposit (LOW) → buys mUSD 90% + USDY 10%, no sells", () => {
  const states = [usdc(1_000_000_000n), tok("mUSD", 0n, E18), tok("USDY", 0n, E18)];
  const ins = computeSwapInstructions(states, SIMPLE_LOW, CFG);

  assert.equal(ins.length, 2);
  assert.ok(ins.every((i) => i.tokenIn === A.USDC), "all buys from USDC");

  const mUSD = ins.find((i) => i.tokenOut === A.mUSD)!;
  const USDY = ins.find((i) => i.tokenOut === A.USDY)!;
  assert.equal(mUSD.amountIn, 900_000_000n); // $900 USDC (6 dec)
  assert.equal(USDY.amountIn, 100_000_000n); // $100 USDC
  // full balance deployed
  assert.equal(mUSD.amountIn + USDY.amountIn, 1_000_000_000n);
});

test("overweight token is sold before buys (sells ordered first)", () => {
  // Holds 1 mETH @ $2000, target LOW (mETH target = 0)
  const states = [
    usdc(0n),
    tok("mUSD", 0n, E18),
    tok("USDY", 0n, E18),
    tok("mETH", 1n * E18, 2000n * E18),
  ];
  const ins = computeSwapInstructions(states, resolveTargetBps(0), CFG);

  assert.equal(ins.length, 3);
  // first instruction is the sell (mETH → USDC)
  assert.equal(ins[0]!.tokenIn, A.mETH);
  assert.equal(ins[0]!.tokenOut, A.USDC);
  assert.equal(ins[0]!.amountIn, 1n * E18); // sell whole mETH
  // remaining are USDC-funded buys
  assert.ok(ins.slice(1).every((i) => i.tokenIn === A.USDC));
});

test("already balanced → no instructions", () => {
  const states = [usdc(0n), tok("mUSD", 900n * E18, E18), tok("USDY", 100n * E18, E18)];
  const ins = computeSwapInstructions(states, SIMPLE_LOW, CFG);
  assert.equal(ins.length, 0);
});

test("sub-dust drift is skipped", () => {
  // $0.50 off target — below the $1 minSwapValueUsd floor
  const states = [
    usdc(0n),
    tok("mUSD", 9005n * (E18 / 10n), E18), // $900.5
    tok("USDY", 995n * (E18 / 10n), E18), // $99.5
  ];
  const ins = computeSwapInstructions(states, SIMPLE_LOW, CFG);
  assert.equal(ins.length, 0);
});

test("minAmountOut applies 1% slippage tolerance", () => {
  const states = [usdc(1_000_000_000n), tok("mUSD", 0n, E18), tok("USDY", 0n, E18)];
  const ins = computeSwapInstructions(states, SIMPLE_LOW, CFG);
  const mUSD = ins.find((i) => i.tokenOut === A.mUSD)!;
  // expect 900 mUSD out, minus 1% → 891
  assert.equal(mUSD.minAmountOut, 891n * E18);
});

test("budget cap: buys never exceed the USDC the sells guarantee (no insufficient-USDC revert)", () => {
  // 0 standalone USDC; liquidate $2000 mETH into mUSD/USDY (LOW). Buys want the full
  // $2000 but sells only GUARANTEE $1980 (1% slippage floor) → must scale down.
  const states = [
    usdc(0n),
    tok("mUSD", 0n, E18),
    tok("USDY", 0n, E18),
    tok("mETH", 1n * E18, 2000n * E18),
  ];
  const ins = computeSwapInstructions(states, resolveTargetBps(0), CFG);
  const sells = ins.filter((i) => i.tokenOut === A.USDC);
  const buys = ins.filter((i) => i.tokenIn === A.USDC);
  const guaranteed = sells.reduce((s, x) => s + x.minAmountOut, 0n); // + 0 starting USDC
  const spent = buys.reduce((s, x) => s + x.amountIn, 0n);
  assert.ok(buys.length >= 1, "still buys");
  assert.ok(spent <= guaranteed, `Σbuys ${spent} must be ≤ guaranteed ${guaranteed}`);
  assert.ok(spent <= 1_980_000_000n); // pre-fix it was 2000e6 (> 1980e6) → reverted
});

test("resolveTargetBps: each preset sums to 10000", () => {
  for (const risk of [0, 1, 2] as const) {
    const total = [...resolveTargetBps(risk).values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 10_000, `risk ${risk}`);
  }
});

test("resolveTargetBps: CUSTOM blends LOW/MEDIUM baskets", () => {
  const m = resolveTargetBps(3, { lowBps: 5000, medBps: 5000, highBps: 0 });
  // 0.5*LOW(mUSD 7000) + 0.5*MEDIUM(mUSD 3000) = 3500+1500 = 5000
  assert.equal(m.get("mUSD"), 5000);
  // 0.5*LOW(USDY 1000) = 500 (USDY only in LOW)
  assert.equal(m.get("USDY"), 500);
  // 0.5*LOW(GILTS 1000) + 0.5*MEDIUM(GILTS 500) = 500+250 = 750
  assert.equal(m.get("GILTS"), 750);
  // 0.5*LOW(XAU 500) + 0.5*MEDIUM(XAU 500) = 250+250 = 500
  assert.equal(m.get("XAU"), 500);
  // 0.5*MEDIUM(mETH 2000) = 1000 (mETH only in MEDIUM)
  assert.equal(m.get("mETH"), 1000);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 10_000);
});

test("resolveTargetBps: CUSTOM must sum to 10000", () => {
  assert.throws(() => resolveTargetBps(3, { lowBps: 5000, medBps: 4000, highBps: 0 }));
});

test("resolveTargetBps: CUSTOM requires an allocation", () => {
  assert.throws(() => resolveTargetBps(3));
});

test("resolveTargetBps: CUSTOM blends all three baskets", () => {
  const m = resolveTargetBps(3, { lowBps: 2000, medBps: 3000, highBps: 5000 });
  // mUSD: .2*7000 + .3*3000 + .5*500 = 1400+900+250 = 2550
  assert.equal(m.get("mUSD"), 2550);
  // mETH: .3*2000 + .5*1500 = 600+750 = 1350
  assert.equal(m.get("mETH"), 1350);
  // cmETH: .3*1000 + .5*2500 = 300+1250 = 1550
  assert.equal(m.get("cmETH"), 1550);
  // sUSDe: .5*1000 = 500 (HIGH only)
  assert.equal(m.get("sUSDe"), 500);
  // USDY: .2*1000 = 200 (LOW only)
  assert.equal(m.get("USDY"), 200);
  // WMNT: .5*500 = 250 (HIGH only)
  assert.equal(m.get("WMNT"), 250);
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 10_000);
});

test("computeSwapInstructions: minSwapValueUsd defaults to 0 (no dust floor)", () => {
  // No minSwapValueUsd → even a $0.50 drift produces swaps.
  const states = [usdc(0n), tok("mUSD", 9005n * (E18 / 10n), E18), tok("USDY", 995n * (E18 / 10n), E18)];
  const ins = computeSwapInstructions(states, resolveTargetBps(0), { slippageBps: 100 });
  assert.equal(ins.length, 2); // sell mUSD excess + buy USDY deficit
});

test("valueUsd: balance * price / 10^decimals", () => {
  assert.equal(valueUsd(usdc(1_000_000n)), 1n * E18); // 1 USDC = $1 (18-dec)
  assert.equal(valueUsd(tok("mETH", 2n * E18, 2000n * E18)), 4000n * E18); // 2 @ $2000
});

test("computeSwapInstructions: throws without USDC", () => {
  assert.throws(() => computeSwapInstructions([tok("mUSD", 0n, E18)], resolveTargetBps(0), CFG));
});

test("computeSwapInstructions: throws when USDC price is zero", () => {
  const states = [usdc(1_000_000n), tok("mUSD", 0n, E18)];
  states[0]!.price = 0n;
  assert.throws(() => computeSwapInstructions(states, resolveTargetBps(0), CFG));
});

test("computeSwapInstructions: zero total value → no swaps", () => {
  const states = [usdc(0n), tok("mUSD", 0n, E18), tok("USDY", 0n, E18)];
  assert.equal(computeSwapInstructions(states, resolveTargetBps(0), CFG).length, 0);
});

test("computeSwapInstructions: a token with zero price is skipped (not sold/bought)", () => {
  // USDC funds, target LOW, but mUSD has no price → cannot trade it.
  const states = [usdc(1_000_000_000n), tok("mUSD", 0n, 0n), tok("USDY", 0n, E18)];
  const ins = computeSwapInstructions(states, resolveTargetBps(0), CFG);
  assert.ok(ins.every((i) => i.tokenOut !== A.mUSD), "mUSD never traded");
  assert.equal(ins.length, 1); // only the USDY buy
  assert.equal(ins[0]!.tokenOut, A.USDY);
});

test("computeSwapInstructions: MEDIUM funds split 40/30/30", () => {
  const states = [
    usdc(1_000_000_000n), // $1000
    tok("mUSD", 0n, E18),
    tok("mETH", 0n, 2000n * E18),
    tok("cmETH", 0n, 2000n * E18),
  ];
  const ins = computeSwapInstructions(states, SIMPLE_MED, CFG);
  assert.equal(ins.length, 3);
  const byOut = (a: string) => ins.find((i) => i.tokenOut === a)!;
  assert.equal(byOut(A.mUSD).amountIn, 400_000_000n); // $400
  assert.equal(byOut(A.mETH).amountIn, 300_000_000n); // $300
  assert.equal(byOut(A.cmETH).amountIn, 300_000_000n); // $300
  // mETH buy: $300 / $2000 = 0.15 mETH, minus 1% slippage
  assert.equal(byOut(A.mETH).minAmountOut, (300n * E18 / 2000n) * 9900n / 10000n);
});

test("computeSwapInstructions: simultaneous over- and under-weight, sells first", () => {
  // SIMPLE_LOW (mUSD 90, USDY 10). Hold $1000 mUSD only → mUSD overweight $100,
  // USDY underweight $100. Expect 1 sell (mUSD→USDC) then 1 buy (USDC→USDY).
  const states = [usdc(0n), tok("mUSD", 1000n * E18, E18), tok("USDY", 0n, E18)];
  const ins = computeSwapInstructions(states, SIMPLE_LOW, CFG);
  assert.equal(ins.length, 2);
  assert.equal(ins[0]!.tokenIn, A.mUSD); // sell first
  assert.equal(ins[0]!.tokenOut, A.USDC);
  assert.equal(ins[0]!.amountIn, 100n * E18); // sell $100 of mUSD
  assert.equal(ins[1]!.tokenIn, A.USDC); // buy after
  assert.equal(ins[1]!.tokenOut, A.USDY);
});

// ── applyAllocationCaps — shared guardrail clamp (auto-rebalancer + executeDirectSwap) ──
const tsym = (s: string) => s as TokenSymbol;
const tmap = (o: Record<string, number>) => new Map(Object.entries(o).map(([k, v]) => [tsym(k), v]));

test("applyAllocationCaps: no guardrails → target unchanged", () => {
  const out = applyAllocationCaps(tmap({ mUSD: 6000, mETH: 4000 }), {
    perTokenCapsBps: null,
    maxPerAssetPct: null,
  });
  assert.deepEqual(Object.fromEntries(out), { mUSD: 6000, mETH: 4000 });
});

test("applyAllocationCaps: maxPerAssetPct caps every asset at the global ceiling", () => {
  // 30% ceiling → each of mUSD/mETH clamped to 3000; the 4000 excess parks in USDC
  const out = applyAllocationCaps(tmap({ mUSD: 5000, mETH: 5000 }), {
    perTokenCapsBps: null,
    maxPerAssetPct: 30,
  });
  assert.equal(out.get(tsym("mUSD")), 3000);
  assert.equal(out.get(tsym("mETH")), 3000);
});

test("applyAllocationCaps: perTokenCapsBps caps the named token, never exceeds it", () => {
  const out = applyAllocationCaps(tmap({ sUSDe: 8000, mUSD: 2000 }), {
    perTokenCapsBps: { sUSDe: 2500 },
    maxPerAssetPct: null,
  });
  assert.equal(out.get(tsym("sUSDe")), 2500);
  assert.ok((out.get(tsym("mUSD")) ?? 0) >= 2000); // residual redistributed to headroom
});

test("applyAllocationCaps: lower of per-token cap and global ceiling wins", () => {
  // global 40% (4000) but sUSDe capped at 25% (2500) → 2500 wins for sUSDe
  const out = applyAllocationCaps(tmap({ sUSDe: 9000, mUSD: 1000 }), {
    perTokenCapsBps: { sUSDe: 2500 },
    maxPerAssetPct: 40,
  });
  assert.ok((out.get(tsym("sUSDe")) ?? 0) <= 2500);
  assert.ok((out.get(tsym("mUSD")) ?? 0) <= 4000); // mUSD bound by the 40% global ceiling
});

// ── per-token drift bands (Option C: cmETH must stay 20-30%, else rebalance) ──
const hold = (symbol: string, allocationPct: number) => ({ symbol, allocationPct });

test("tokensOutOfBand: flags a holding above its band max", () => {
  const holdings = [hold("cmETH", 35), hold("mUSD", 50), hold("USDY", 15)];
  // cmETH band 20-30% → 35% breaches; USDY band 10-20% → 15% ok; mUSD no band
  assert.deepEqual(
    tokensOutOfBand(holdings, { cmETH: { min: 2000, max: 3000 }, USDY: { min: 1000, max: 2000 } }),
    ["cmETH"],
  );
});

test("tokensOutOfBand: flags a holding below its band min (the floor)", () => {
  assert.deepEqual(tokensOutOfBand([hold("cmETH", 15)], { cmETH: { min: 2000, max: 3000 } }), ["cmETH"]);
});

test("tokensOutOfBand: within band → none; null bands → none", () => {
  assert.deepEqual(tokensOutOfBand([hold("cmETH", 25)], { cmETH: { min: 2000, max: 3000 } }), []);
  assert.deepEqual(tokensOutOfBand([hold("cmETH", 99)], null), []);
});

test("applyAllocationCaps: a band's max edge acts as a hard cap", () => {
  // cmETH band max 30% → 50% requested clamps to ≤3000 bps
  const out = applyAllocationCaps(tmap({ cmETH: 5000, mUSD: 5000 }), {
    perTokenBandsBps: { cmETH: { min: 2000, max: 3000 } },
  });
  assert.ok((out.get(tsym("cmETH")) ?? 0) <= 3000);
});
