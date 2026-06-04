import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listStrategies, riskLevelFromId } from "../../strategies.js";
import { projectForRisk } from "../../services/projection.js";
import { readHoldings } from "../../services/holdings.js";
import { getAgentConfig, upsertAgentConfig } from "../../services/agent-config.js";
import { prismaApyReader } from "../../api/routes/apy.js";
import { prisma } from "../../db/client.js";
import { as0x } from "../../chain/addresses.js";

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
    return { holdings, totalValueUsd };
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
    "Update the signed-in user's agent guardrails. Include ONLY the fields to change. Off-chain, takes effect immediately, fully reversible — no wallet signature needed. Use this to: pause/resume auto-rebalance (autoRebalanceEnabled), set max slippage (maxSlippageBps, 100=1%), cap a token's max allocation (perTokenCapsBps, e.g. {\"sUSDe\":3000} = 30%), change rebalance cadence (cadenceSec), set a drift threshold (driftThresholdBps), or save preference notes.",
  inputSchema: z.object({
    autoRebalanceEnabled: z.boolean().optional(),
    cadenceSec: z.number().int().nonnegative().nullable().optional(),
    driftThresholdBps: z.number().int().min(0).max(10_000).nullable().optional(),
    maxSlippageBps: z.number().int().min(0).max(5_000).optional(),
    perTokenCapsBps: z.record(z.string(), z.number().int().min(0).max(10_000)).nullable().optional(),
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
      return { ok: true, settings: updated };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});

export const tendsTools = {
  listStrategies: listStrategiesTool,
  computeProjection: computeProjectionTool,
  getApyHistory: getApyHistoryTool,
  readUserPosition: readUserPositionTool,
  getHoldings: getHoldingsTool,
  getAgentSettings: getAgentSettingsTool,
  getRecentActivity: getRecentActivityTool,
  setAgentGuardrails: setAgentGuardrailsTool,
};
