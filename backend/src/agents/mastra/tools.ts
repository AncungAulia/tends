import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listStrategies, riskLevelFromId } from "../../strategies.js";
import { projectForRisk } from "../../services/projection.js";
import { readHoldings } from "../../services/holdings.js";
import { getAgentConfig, upsertAgentConfig } from "../../services/agent-config.js";
import { enforceGuardrails } from "./workflows/enforce-guardrails.js";
import { runHermesRebalance } from "./workflows/rebalancer-workflow.js";
import { prismaApyReader } from "../../api/routes/apy.js";
import { prisma } from "../../db/client.js";
import { addresses, as0x } from "../../chain/addresses.js";
import { publicClient } from "../../chain/index.js";
import { ERC20_ABI, PRICE_FEED_ABI } from "../../chain/abis.js";
import { TOKENS, type TokenSymbol } from "../../chain/tokens.js";
import {
  computeSwapInstructions,
  applyAllocationCaps,
  applyExclusions,
  type TokenState,
} from "../../services/rebalance-math.js";
import {
  defaultRebalancerDeps,
  SLIPPAGE_BPS,
} from "../../services/rebalancer.js";
import { agentLogEmitter } from "../../services/agent-log-emitter.js";

const strategyId = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);

/** RequestContext shape the chat route binds from the authenticated Privy session. */
export type AgentRequestContext = { walletAddress: string | null };

/**
 * The user's wallet ALWAYS comes from the authenticated session (RequestContext),
 * NEVER from the LLM — so a prompt-injected message can't make the agent read or
 * mutate someone else's account. The chat route sets it from the Privy token.
 */
function sessionWallet(context: unknown): string | null {
  const ctx = context as { requestContext?: { get?: (k: string) => unknown } } | undefined;
  return (ctx?.requestContext?.get?.("walletAddress") as string | null | undefined) ?? null;
}

async function vaultOf(walletAddress: string): Promise<`0x${string}` | null> {
  const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
  return vault ? as0x(vault.address) : null;
}

// ── Read tools that don't need the user ──────────────────────────────────────

const listStrategiesTool = createTool({
  id: "listStrategies",
  description: "List the strategies (LOW/MEDIUM/HIGH/CUSTOM) with their blended APY.",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => ({ strategies: listStrategies() }),
});

const computeProjectionTool = createTool({
  id: "computeProjection",
  description: "Project the future USD value of a capital amount in a strategy over a number of days.",
  inputSchema: z.object({
    strategyId,
    capital: z.number().positive().describe("USD principal"),
    durationDays: z.number().int().positive(),
  }),
  outputSchema: z.any(),
  execute: async ({ strategyId, capital, durationDays }) => {
    const risk = riskLevelFromId(strategyId);
    if (risk == null) throw new Error(`unknown strategy ${strategyId}`);
    return projectForRisk(risk, capital, durationDays);
  },
});

const getApyHistoryTool = createTool({
  id: "getApyHistory",
  description: "Historical APY series for an asset (e.g. sUSDe, USDY, cmETH) over the last N days.",
  inputSchema: z.object({ asset: z.string(), days: z.number().int().min(1).max(365).default(30) }),
  outputSchema: z.any(),
  execute: async ({ asset, days }) => ({ asset, history: await prismaApyReader.history(asset, days) }),
});

// ── User-scoped tools — wallet from the session, NOT the LLM ──────────────────

const getUserProfileTool = createTool({
  id: "getUserProfile",
  description: "Get the signed-in user's display name, wallet address, and onboarding preferences (goal, riskTolerance). Call this at the start of any conversation to greet the user by name and understand their intent.",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async (_input, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { name: null, walletAddress: null, goal: null, riskTolerance: null };
    const user = await prisma.user.findUnique({
      where: { walletAddress: wallet },
      select: { name: true, walletAddress: true, goal: true, riskTolerance: true },
    });
    return {
      name: user?.name ?? null,
      walletAddress: wallet,
      goal: user?.goal ?? null,           // 'safe' | 'steady' | 'max'
      riskTolerance: user?.riskTolerance ?? null, // 'out' | 'wait' | 'add'
    };
  },
});

const readUserPositionTool = createTool({
  id: "readUserPosition",
  description: "Read the signed-in user's Tends vault (address, risk preference, deposit).",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async (_input, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { vault: null, note: "no wallet linked to this session" };
    const vault = await prisma.vault.findUnique({ where: { owner: wallet } });
    return vault ? { vault } : { vault: null, note: "no vault deployed yet" };
  },
});

const getHoldingsTool = createTool({
  id: "getHoldings",
  description:
    "Read the signed-in user's CURRENT on-chain holdings: each token's balance, USD value, allocation %, and total portfolio value.",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async (_input, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { holdings: [], totalValueUsd: "0", note: "no wallet linked" };
    const vault = await vaultOf(wallet);
    if (!vault) return { holdings: [], totalValueUsd: "0", note: "no vault deployed yet" };
    const { holdings, totalValueUsd } = await readHoldings(vault);
    // Expose only USD value + allocation — not raw token balances — so the model
    // doesn't confuse token amounts with dollar amounts.
    return {
      holdings: holdings.map((h) => ({
        symbol: h.symbol,
        valueUsd: Number(h.valueUsd).toFixed(2),
        allocationPct: h.allocationPct,
      })),
      totalValueUsd: Number(totalValueUsd).toFixed(2),
    };
  },
});

const getAgentSettingsTool = createTool({
  id: "getAgentSettings",
  description:
    "Read the signed-in user's agent guardrails: auto-rebalance on/off, cadence, drift threshold, max slippage, per-token caps, notes.",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async (_input, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { note: "no wallet linked" };
    const vault = await vaultOf(wallet);
    if (!vault) return { note: "no vault deployed yet" };
    return getAgentConfig(vault);
  },
});

const getRecentActivityTool = createTool({
  id: "getRecentActivity",
  description: "Recent agent activity for the signed-in user's vault (rebalances, deposits, withdrawals, pauses).",
  inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
  outputSchema: z.any(),
  execute: async ({ limit }, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { activities: [] };
    const vault = await vaultOf(wallet);
    if (!vault) return { activities: [] };
    const activities = await prisma.agentActivity.findMany({
      where: { vaultAddress: vault },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return { activities };
  },
});

// ── Action tool — mutates the signed-in user's OWN guardrails (off-chain, reversible) ──

const setAgentGuardrailsTool = createTool({
  id: "setAgentGuardrails",
  description:
    "Update the signed-in user's agent GUARDRAILS (safety limits the auto-rebalancer respects). Off-chain, instant, reversible, NO signature. Include ONLY fields to change. Fields: " +
    "autoRebalanceEnabled (pause/resume the agent); " +
    "maxSlippageBps (swap slippage tolerance, 100=1%, 200=2%); " +
    "maxPerAssetPct (global max allocation % per single token, e.g. 30 = no token can exceed 30% of portfolio; null = default 50%); " +
    "dailyLimitPerDay (max number of rebalances per day; null = no limit); " +
    "stopLossEnabled (true/false — enable auto-exit when portfolio drops below stop-loss level); " +
    "stopLossPct (e.g. 10 = exit all positions if portfolio drops -10% from cost basis; requires stopLossEnabled=true); " +
    "perTokenCapsBps — an independent MAXIMUM per token in bps (3000 = max 30% of portfolio). Each token is a separate ceiling; they do NOT need to sum to 100. e.g. cap sUSDe at 25% → {\"sUSDe\":2500}. This is a safety limit, NOT the strategy allocation; " +
    "perTokenBandsBps — a drift BAND per token { min, max } in bps. When the token's allocation drifts outside the band, the agent rebalances it back to target right after each price update. e.g. 'keep cmETH between 20% and 30%' → {\"cmETH\":{\"min\":2000,\"max\":3000}}; " +
    "cadenceSec (min seconds between rebalances); driftThresholdBps (only rebalance if drift exceeds this); notes (free text). " +
    "NOTE: this does NOT change the on-chain risk strategy (that needs the user's signature in the app).",
  inputSchema: z.object({
    autoRebalanceEnabled: z.boolean().optional(),
    cadenceSec: z.number().int().nonnegative().nullable().optional(),
    driftThresholdBps: z.number().int().min(0).max(10_000).nullable().optional(),
    maxSlippageBps: z.number().int().min(0).max(5_000).optional(),
    maxPerAssetPct: z.number().int().min(1).max(100).nullable().optional(),
    dailyLimitPerDay: z.number().int().min(1).max(100).nullable().optional(),
    stopLossEnabled: z.boolean().optional(),
    stopLossPct: z.number().int().min(1).max(99).nullable().optional(),
    perTokenCapsBps: z.record(z.string(), z.number().int().min(0).max(10_000)).nullable().optional(),
    perTokenBandsBps: z
      .record(
        z.string(),
        z.object({ min: z.number().int().min(0).max(10_000), max: z.number().int().min(0).max(10_000) }),
      )
      .nullable()
      .optional(),
    notes: z.string().max(1_000).nullable().optional(),
  }),
  outputSchema: z.any(),
  execute: async (patch, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { error: "no wallet linked to this session" };
    const vault = await vaultOf(wallet);
    if (!vault) return { error: "no vault deployed yet — deploy a vault first" };
    try {
      const updated = await upsertAgentConfig(vault, patch);
      // enforce the new guardrails (rebalance if a cap is now violated) — async,
      // same as the POST /agent-config endpoint, so agent- and UI-driven changes match
      void enforceGuardrails(vault).catch(() => {});
      return { ok: true, settings: updated };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

/** Read + advisory tools — safe for any model (no mutations). */
export const tendsReadTools = {
  getUserProfile: getUserProfileTool,
  listStrategies: listStrategiesTool,
  computeProjection: computeProjectionTool,
  getApyHistory: getApyHistoryTool,
  readUserPosition: readUserPositionTool,
  getHoldings: getHoldingsTool,
  getAgentSettings: getAgentSettingsTool,
  getRecentActivity: getRecentActivityTool,
};

// ── CFO action: trigger Hermes-driven rebalance ──────────────────────────────

const triggerRebalanceTool = createTool({
  id: "triggerRebalance",
  description:
    "Run an LLM-driven rebalance for the signed-in user's vault RIGHT NOW. " +
    "Hermes analyses current prices, APY, holdings, strategy bounds, and the user's investment policy " +
    "to decide the optimal allocation, then executes it on-chain. " +
    "Returns outcome (rebalanced/skip/liquidated), reasoning (why Hermes chose this allocation), " +
    "allocation (the decided token percentages), and attempts (LLM validation rounds). " +
    "Only call this when the user explicitly requests an immediate rebalance.",
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async (_input, context) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { error: "no wallet linked to this session" };
    const vault = await vaultOf(wallet);
    if (!vault) return { error: "no vault deployed yet — deploy a vault first" };
    try {
      return await runHermesRebalance(vault);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

// ── Chat-directed swap: user specifies target allocation, agent executes ────────

const executeDirectSwapTool = createTool({
  id: "executeDirectSwap",
  description:
    "Execute a user-directed portfolio swap on-chain based on natural language intent. " +
    "ALWAYS call getHoldings FIRST to see current balances and allocation percentages. " +
    "Then convert the user's intent into targetBps: a mapping from token symbol → desired allocation in basis points (100 bps = 1%, 10000 bps = 100%). " +
    "USDC is the routing medium with an IMPLICIT 0% target — do NOT include USDC in targetBps. " +
    "Tokens NOT listed in targetBps will be SOLD to USDC automatically. " +
    "Sum of all targetBps values must be ≤ 10000. If sum < 10000, the remainder is held in USDC. " +
    "Examples: " +
    "'swap all USDC to mETH' with holdings {USDC:50%, mETH:20%, AAPL:30%} → targetBps: {mETH:7000, AAPL:3000}. " +
    "'swap all stocks to mUSD' with holdings {AAPL:10%,TSLA:5%,NVDA:5%,mUSD:30%,USDC:50%} → targetBps: {mUSD:10000}. " +
    "'move 30% of cmETH to sUSDe' → compute bps delta and adjust accordingly. " +
    "Always describe in chat what you will execute BEFORE calling this tool. " +
    "On success, report the tx hash and the number of swaps executed.",
  inputSchema: z.object({
    targetBps: z
      .record(z.string(), z.number().int().min(0).max(10_000))
      .describe(
        "Token symbol → desired allocation in bps. Sum ≤ 10000. Do NOT include USDC. Tokens absent from this map will be sold.",
      ),
    reasoning: z
      .string()
      .describe("One sentence in English: what the user asked for and what this swap does. Always English — this is written to the audit log regardless of the conversation language."),
  }),
  outputSchema: z.any(),
  execute: async (
    { targetBps, reasoning }: { targetBps: Record<string, number>; reasoning: string },
    context,
  ) => {
    const wallet = sessionWallet(context);
    if (!wallet) return { error: "no wallet linked to this session" };
    const vault = await vaultOf(wallet);
    if (!vault) return { error: "no vault deployed yet — deploy a vault first" };

    // Validate all symbols exist in the token registry.
    const unknown = Object.keys(targetBps).filter((s) => !(s in TOKENS));
    if (unknown.length) return { error: `Unknown token symbol(s): ${unknown.join(", ")}` };

    const totalBps = Object.values(targetBps).reduce((s, v) => s + v, 0);
    if (totalBps > 10_000) {
      return { error: `targetBps sums to ${totalBps} — must be ≤ 10000` };
    }

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
        return {
          symbol: t.symbol,
          address: as0x(t.address),
          decimals: t.decimals,
          balance,
          price,
        };
      }),
    );

    // Build target allocation map from user's input.
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
          outcome: "error",
          reason: `daily trade limit reached (${todayCount}/${config.dailyLimitPerDay} today) — raise it in agent settings or try tomorrow`,
        };
      }
    }

    // GUARDRAIL: same pipeline as the auto-rebalancer — drop "Avoid" tokens first,
    // then clamp to per-asset ceiling + per-token caps. A chat command can't sneak
    // past either limit; the excess parks in USDC.
    const afterExclusion = applyExclusions(targetMap, config.excludedTokens);
    const cappedTarget = applyAllocationCaps(afterExclusion, config);

    const slippageBps = config.maxSlippageBps ?? SLIPPAGE_BPS;
    const instructions = computeSwapInstructions(states, cappedTarget, {
      slippageBps,
    });

    if (instructions.length === 0) {
      return { outcome: "skip", reason: "already at target allocation — no swaps needed" };
    }

    agentLogEmitter.log({
      vaultAddress: vault,
      workflow: "chat",
      step: "direct-swap",
      status: "running",
      message: `Chat swap: ${reasoning}`,
      data: { swaps: instructions.length },
    });

    const ok = await defaultRebalancerDeps.simulateRebalance(vault, instructions);
    if (!ok) {
      agentLogEmitter.log({
        vaultAddress: vault,
        workflow: "chat",
        step: "direct-swap",
        status: "error",
        message: "Chat swap simulation failed — trade would revert on-chain",
        data: { reasoning },
      });
      return {
        outcome: "error",
        reason: "swap simulation failed — the trade would revert on-chain. Possible causes: stale price feed, insufficient vault balance, or slippage too tight.",
      };
    }

    const hash = await defaultRebalancerDeps.sendRebalance(vault, instructions);

    agentLogEmitter.log({
      vaultAddress: vault,
      workflow: "chat",
      step: "direct-swap",
      status: "done",
      message: `Chat swap executed: ${instructions.length} trade(s) — ${reasoning}`,
      data: { hash, swaps: instructions.length, reasoning },
    });

    return {
      outcome: "executed",
      hash,
      swaps: instructions.length,
      reasoning,
    };
  },
});

/** Mutating tools — guardrail updates + Hermes-driven rebalance execution. */
export const tendsActionTools = {
  setAgentGuardrails: setAgentGuardrailsTool,
  triggerRebalance: triggerRebalanceTool,
  executeDirectSwap: executeDirectSwapTool,
};

/** Default toolset for the chat agent (Hermes) = reads only. */
export const tendsTools = tendsReadTools;
