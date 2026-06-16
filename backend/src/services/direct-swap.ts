import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { ERC20_ABI, PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS, type TokenSymbol } from "../chain/tokens.js";
import { getAgentConfig } from "./agent-config.js";
import {
  computeSwapInstructions,
  applyAllocationCaps,
  applyExclusions,
  type TokenState,
  type SwapInstruction,
} from "./rebalance-math.js";
import { defaultRebalancerDeps, SLIPPAGE_BPS } from "./rebalancer.js";
import { agentLogEmitter } from "./agent-log-emitter.js";

/**
 * Shared swap engine for chat-initiated, user-directed swaps. `planDirectSwap`
 * validates + reads on-chain state + applies the same guardrails as the auto
 * rebalancer + computes & simulates the swaps WITHOUT executing — so the agent can
 * PROPOSE a swap and the user can confirm it before any funds move. `runDirectSwap`
 * re-plans from fresh state and executes. See chat propose/confirm flow.
 */

export type PlanResult =
  | { ok: true; instructions: SwapInstruction[]; swaps: number }
  | { ok: false; reason: string };

export async function planDirectSwap(
  vault: `0x${string}`,
  targetBps: Record<string, number>,
): Promise<PlanResult> {
  const unknown = Object.keys(targetBps).filter((s) => !(s in TOKENS));
  if (unknown.length) return { ok: false, reason: `Unknown token symbol(s): ${unknown.join(", ")}` };

  const totalBps = Object.values(targetBps).reduce((s, v) => s + v, 0);
  if (totalBps > 10_000) return { ok: false, reason: `targetBps sums to ${totalBps}, must be ≤ 10000` };

  // Read current on-chain balances + prices for all registered tokens.
  const tokenList = Object.values(TOKENS).filter((t) => t.address);
  const states: TokenState[] = await Promise.all(
    tokenList.map(async (t) => {
      const [balance, price] = await Promise.all([
        publicClient.readContract({
          address: as0x(t.address),
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [vault],
        }),
        publicClient.readContract({
          address: as0x(addresses.priceFeed),
          abi: PRICE_FEED_ABI,
          functionName: "getPrice",
          args: [as0x(t.address)],
        }),
      ]);
      return { symbol: t.symbol, address: as0x(t.address), decimals: t.decimals, balance, price };
    }),
  );

  const targetMap = new Map<TokenSymbol, number>();
  for (const [sym, bps] of Object.entries(targetBps)) {
    if (bps > 0) targetMap.set(sym as TokenSymbol, bps);
  }

  const config = await getAgentConfig(vault);

  // GUARDRAIL: honor the user's daily trade limit (shared counter with the
  // auto-rebalancer — counts today's on-chain REBALANCE activities).
  if (config.dailyLimitPerDay != null) {
    const todayCount = await defaultRebalancerDeps.countTodayRebalances(vault);
    if (todayCount >= config.dailyLimitPerDay) {
      return {
        ok: false,
        reason: `daily trade limit reached (${todayCount}/${config.dailyLimitPerDay} today). Raise it in agent settings or try tomorrow.`,
      };
    }
  }

  // GUARDRAIL: drop "Avoid" tokens, then clamp to per-asset ceiling + per-token caps.
  const afterExclusion = applyExclusions(targetMap, config.excludedTokens);
  const cappedTarget = applyAllocationCaps(afterExclusion, config);

  const slippageBps = config.maxSlippageBps ?? SLIPPAGE_BPS;
  const instructions = computeSwapInstructions(states, cappedTarget, { slippageBps });

  if (instructions.length === 0) {
    return { ok: false, reason: "already at target allocation, no swaps needed" };
  }

  const okSim = await defaultRebalancerDeps.simulateRebalance(vault, instructions);
  if (!okSim) {
    return {
      ok: false,
      reason:
        "swap simulation failed: the trade would revert on-chain. Possible causes: stale price feed, insufficient vault balance, or slippage too tight.",
    };
  }

  return { ok: true, instructions, swaps: instructions.length };
}

export type RunResult =
  | { ok: true; hash: `0x${string}`; swaps: number }
  | { ok: false; reason: string };

/** Re-plan from fresh on-chain state and execute. Used by the confirm endpoint. */
export async function runDirectSwap(
  vault: `0x${string}`,
  targetBps: Record<string, number>,
  reasoning: string,
): Promise<RunResult> {
  const plan = await planDirectSwap(vault, targetBps);
  if (!plan.ok) return plan;

  agentLogEmitter.log({
    vaultAddress: vault,
    workflow: "chat",
    step: "direct-swap",
    status: "running",
    message: `Chat swap: ${reasoning}`,
    data: { swaps: plan.swaps },
  });

  const hash = await defaultRebalancerDeps.sendRebalance(vault, plan.instructions);

  agentLogEmitter.log({
    vaultAddress: vault,
    workflow: "chat",
    step: "direct-swap",
    status: "done",
    message: `Chat swap executed: ${plan.swaps} trade(s). ${reasoning}`,
    data: { hash, swaps: plan.swaps, reasoning },
  });

  return { ok: true, hash, swaps: plan.swaps };
}
