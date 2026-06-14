import {
  STRATEGY,
  RISK_LEVEL,
  TOKENS,
  type RiskLevel,
  type TokenSymbol,
} from "../chain/tokens.js";

/** One swap leg passed to UserVault.rebalance(). */
export interface SwapInstruction {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
}

/** A token's on-chain state needed to plan a rebalance. */
export interface TokenState {
  symbol: TokenSymbol;
  address: `0x${string}`;
  decimals: number;
  /** Balance in smallest units. */
  balance: bigint;
  /** USD price, 18 decimals (PriceFeed convention). Static $1 tokens = 1e18. */
  price: bigint;
}

export interface RebalanceConfig {
  /** Slippage tolerance for minAmountOut, in bps (vault default 100 = 1%). */
  slippageBps: number;
  /** Skip swaps whose USD value (18-dec) is below this, to avoid dust churn. */
  minSwapValueUsd?: bigint;
}

export interface CustomAllocation {
  lowBps: number;
  medBps: number;
  highBps: number;
}

const BPS = 10_000n;

/** USD value (18-dec) of a token balance: balance * price / 10^decimals. */
export const valueUsd = (t: TokenState): bigint =>
  (t.balance * t.price) / 10n ** BigInt(t.decimals);

/**
 * Resolve a risk level to target allocation in bps per token (sums to 10000).
 * CUSTOM blends the LOW/MEDIUM/HIGH baskets by the user's lowBps/medBps/highBps.
 */
export function resolveTargetBps(
  risk: RiskLevel,
  custom?: CustomAllocation,
): Map<TokenSymbol, number> {
  const acc = new Map<TokenSymbol, number>();
  const add = (weightBps: number, legs: { token: TokenSymbol; bps: number }[]) => {
    for (const leg of legs) {
      const contrib = Math.round((leg.bps * weightBps) / 10_000);
      acc.set(leg.token, (acc.get(leg.token) ?? 0) + contrib);
    }
  };

  switch (risk) {
    case RISK_LEVEL.LOW:
      add(10_000, STRATEGY.LOW);
      break;
    case RISK_LEVEL.MEDIUM:
      add(10_000, STRATEGY.MEDIUM);
      break;
    case RISK_LEVEL.HIGH:
      add(10_000, STRATEGY.HIGH);
      break;
    case RISK_LEVEL.CUSTOM: {
      if (!custom) throw new Error("CUSTOM risk requires customAllocation");
      if (custom.lowBps + custom.medBps + custom.highBps !== 10_000) {
        throw new Error("customAllocation must sum to 10000 bps");
      }
      add(custom.lowBps, STRATEGY.LOW);
      add(custom.medBps, STRATEGY.MEDIUM);
      add(custom.highBps, STRATEGY.HIGH);
      break;
    }
  }
  return acc;
}

/**
 * Pure guardrail: clamp each token's target to its cap (bps), redistributing the
 * removed weight to under-cap tokens proportional to their headroom. Any residual
 * that can't fit (all caps saturated) is dropped → effectively raises USDC's implicit
 * weight, which is the safe outcome. Tokens absent from `caps` are uncapped.
 */
export function clampTargetToCaps(
  target: Map<TokenSymbol, number>,
  caps: Partial<Record<TokenSymbol, number>>,
): Map<TokenSymbol, number> {
  const result = new Map(target);
  let residual = 0;
  for (const [token, bps] of result) {
    const cap = caps[token];
    if (cap !== undefined && bps > cap) {
      residual += bps - cap;
      result.set(token, cap);
    }
  }
  // Redistribute the excess 1 bps at a time into whichever token has the most
  // headroom. Exact (total conserved), never exceeds a cap; any excess that can't
  // fit (all caps saturated) is simply dropped → raises USDC's implicit weight.
  const headroomOf = (token: TokenSymbol): number => {
    const cap = caps[token];
    return cap === undefined ? 10_000 - (result.get(token) ?? 0) : cap - (result.get(token) ?? 0);
  };
  while (residual > 0) {
    let best: TokenSymbol | null = null;
    let bestRoom = 0;
    for (const token of result.keys()) {
      const room = headroomOf(token);
      if (room > bestRoom) {
        bestRoom = room;
        best = token;
      }
    }
    if (best === null) break; // no headroom left → residual falls through to USDC
    result.set(best, (result.get(best) ?? 0) + 1);
    residual--;
  }
  return result;
}

/**
 * Clamp a target allocation to the user's guardrails: a global per-asset ceiling
 * (maxPerAssetPct, a %) merged with per-token caps (perTokenCapsBps) — the lower wins
 * per token. Excess that can't fit falls through to USDC. Shared by the auto-rebalancer
 * and the chat-driven executeDirectSwap so BOTH paths honor the same limits.
 */
export function applyAllocationCaps(
  target: Map<TokenSymbol, number>,
  guardrails: {
    perTokenCapsBps?: Partial<Record<TokenSymbol, number>> | null;
    maxPerAssetPct?: number | null;
    perTokenBandsBps?: Partial<Record<TokenSymbol, { min: number; max: number }>> | null;
  },
): Map<TokenSymbol, number> {
  const globalCapBps = guardrails.maxPerAssetPct != null ? guardrails.maxPerAssetPct * 100 : null;
  if (globalCapBps == null && !guardrails.perTokenCapsBps && !guardrails.perTokenBandsBps) return target;
  const effectiveCaps: Partial<Record<TokenSymbol, number>> = {};
  if (globalCapBps != null) {
    for (const sym of Object.keys(TOKENS) as TokenSymbol[]) {
      const perToken = guardrails.perTokenCapsBps?.[sym];
      effectiveCaps[sym] = perToken !== undefined ? Math.min(perToken, globalCapBps) : globalCapBps;
    }
  } else {
    Object.assign(effectiveCaps, guardrails.perTokenCapsBps);
  }
  // a band's upper edge (max) is also a hard cap — the lower of all wins per token
  if (guardrails.perTokenBandsBps) {
    for (const [sym, band] of Object.entries(guardrails.perTokenBandsBps)) {
      const t = sym as TokenSymbol;
      effectiveCaps[t] = effectiveCaps[t] === undefined ? band.max : Math.min(effectiveCaps[t]!, band.max);
    }
  }
  return clampTargetToCaps(target, effectiveCaps);
}

/**
 * Pure: symbols whose CURRENT allocation (%) sits OUTSIDE its configured band
 * [min,max] (bps). Used as a rebalance trigger — a holding drifting below its floor
 * or above its ceiling means the portfolio should be rebalanced back toward target.
 */
export function tokensOutOfBand(
  holdings: { symbol: string; allocationPct: number }[],
  bands: Partial<Record<string, { min: number; max: number }>> | null | undefined,
): string[] {
  if (!bands) return [];
  return holdings
    .filter((h) => {
      const band = bands[h.symbol];
      return band != null && (h.allocationPct < band.min / 100 || h.allocationPct > band.max / 100);
    })
    .map((h) => h.symbol);
}

/** Min-swap USD floor from a drift threshold (bps of portfolio): skip churn below it. */
export const driftFloorWad = (driftThresholdBps: number, totalValueWad: bigint): bigint =>
  (BigInt(driftThresholdBps) * totalValueWad) / BPS;

/**
 * Pure rebalance planner. Routes everything through USDC (the vault's base asset
 * and unit of account): overweight RWA tokens are sold to USDC, then idle USDC is
 * spent buying underweight tokens. USDC itself has an implicit 0% target.
 *
 * Sells are emitted before buys so the swaps fund themselves when executed in
 * order by the vault.
 */
export function computeSwapInstructions(
  tokens: TokenState[],
  targetBps: Map<TokenSymbol, number>,
  cfg: RebalanceConfig,
): SwapInstruction[] {
  const usdc = tokens.find((t) => t.symbol === "USDC");
  if (!usdc) throw new Error("USDC token state is required");
  if (usdc.price === 0n) throw new Error("USDC price is zero");

  const totalValue = tokens.reduce((sum, t) => sum + valueUsd(t), 0n);
  if (totalValue === 0n) return [];

  const slip = BigInt(10_000 - cfg.slippageBps);
  const minSwap = cfg.minSwapValueUsd ?? 0n;
  const usdcUnit = 10n ** BigInt(usdc.decimals);

  const sells: SwapInstruction[] = [];
  const buys: SwapInstruction[] = [];

  for (const t of tokens) {
    if (t.symbol === "USDC") continue; // routing medium, implicit 0% target
    if (t.price === 0n) continue; // can't value/price → skip

    const target = (totalValue * BigInt(targetBps.get(t.symbol) ?? 0)) / BPS;
    const current = valueUsd(t);
    const tokenUnit = 10n ** BigInt(t.decimals);

    if (current > target) {
      const excessUsd = current - target;
      if (excessUsd < minSwap) continue;
      const amountIn = (excessUsd * tokenUnit) / t.price; // token units to sell
      const expectedUsdc = (excessUsd * usdcUnit) / usdc.price;
      sells.push({
        tokenIn: t.address,
        tokenOut: usdc.address,
        amountIn,
        minAmountOut: (expectedUsdc * slip) / BPS,
      });
    } else if (target > current) {
      const deficitUsd = target - current;
      if (deficitUsd < minSwap) continue;
      const amountInUsdc = (deficitUsd * usdcUnit) / usdc.price; // USDC to spend
      const expectedToken = (deficitUsd * tokenUnit) / t.price;
      buys.push({
        tokenIn: usdc.address,
        tokenOut: t.address,
        amountIn: amountInUsdc,
        minAmountOut: (expectedToken * slip) / BPS,
      });
    }
  }

  // Budget buys against the USDC the vault is GUARANTEED to hold after the sells:
  // its current USDC + Σ(sell minAmountOut). The contract executes each buy with its
  // full amountIn, so if Σbuys exceeds that floor the last buy reverts on insufficient
  // USDC (sells realize ≥ minAmountOut, never the full estimate). Scale buys down
  // proportionally so Σbuys ≤ guaranteed — under-buying converges over cycles, a revert
  // never does.
  const guaranteedUsdc = usdc.balance + sells.reduce((s, x) => s + x.minAmountOut, 0n);
  const desiredBuyUsdc = buys.reduce((s, x) => s + x.amountIn, 0n);
  const cappedBuys =
    desiredBuyUsdc > guaranteedUsdc && desiredBuyUsdc > 0n
      ? buys
          .map((b) => ({
            ...b,
            amountIn: (b.amountIn * guaranteedUsdc) / desiredBuyUsdc,
            minAmountOut: (b.minAmountOut * guaranteedUsdc) / desiredBuyUsdc,
          }))
          .filter((b) => b.amountIn > 0n)
      : buys;

  return [...sells, ...cappedBuys];
}
