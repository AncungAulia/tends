import {
  STRATEGY,
  RISK_LEVEL,
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

  return [...sells, ...buys];
}
