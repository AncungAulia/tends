import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listStrategies, riskLevelFromId } from "../../strategies.js";
import { projectForRisk } from "../../services/projection.js";
import { readHoldings } from "../../services/holdings.js";
import { getAgentConfig } from "../../services/agent-config.js";
import { prismaApyReader } from "../../api/routes/apy.js";
import { prisma } from "../../db/client.js";
import { as0x } from "../../chain/addresses.js";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid wallet address");
const strategyId = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);

/** Resolve a user's wallet → their vault address (null if none deployed). */
async function vaultOf(walletAddress: string): Promise<`0x${string}` | null> {
  const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
  return vault ? as0x(vault.address) : null;
}

/**
 * Tools for the Tends portfolio agent — native Mastra ports reusing the same pure
 * services + on-chain readers the REST API / rebalancer use, so the chat agent's
 * answers match the dashboard exactly.
 */

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

const readUserPositionTool = createTool({
  id: "readUserPosition",
  description:
    "Read the user's Tends vault record (address, risk preference, deposit). Pass the user's wallet address.",
  inputSchema: z.object({ walletAddress: address }),
  outputSchema: z.any(),
  execute: async ({ walletAddress }) => {
    const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
    return vault ? { vault } : { vault: null, note: "no vault deployed yet" };
  },
});

const getHoldingsTool = createTool({
  id: "getHoldings",
  description:
    "Read the user's CURRENT on-chain holdings: each token's balance, USD value, and allocation %, plus total portfolio value. Pass the user's wallet address.",
  inputSchema: z.object({ walletAddress: address }),
  outputSchema: z.any(),
  execute: async ({ walletAddress }) => {
    const vault = await vaultOf(walletAddress);
    if (!vault) return { holdings: [], totalValueUsd: "0", note: "no vault deployed yet" };
    const { holdings, totalValueUsd } = await readHoldings(vault);
    return { holdings, totalValueUsd };
  },
});

const getAgentSettingsTool = createTool({
  id: "getAgentSettings",
  description:
    "Read the user's agent guardrails/settings: auto-rebalance on/off, rebalance cadence, drift threshold, max slippage, per-token caps, notes. Pass the user's wallet address.",
  inputSchema: z.object({ walletAddress: address }),
  outputSchema: z.any(),
  execute: async ({ walletAddress }) => {
    const vault = await vaultOf(walletAddress);
    if (!vault) return { note: "no vault deployed yet" };
    return getAgentConfig(vault);
  },
});

const getRecentActivityTool = createTool({
  id: "getRecentActivity",
  description:
    "Recent agent activity for the user's vault (rebalances, deposits, withdrawals, pauses). Pass the user's wallet address.",
  inputSchema: z.object({
    walletAddress: address,
    limit: z.number().int().min(1).max(50).default(10),
  }),
  outputSchema: z.any(),
  execute: async ({ walletAddress, limit }) => {
    const vault = await vaultOf(walletAddress);
    if (!vault) return { activities: [] };
    const activities = await prisma.agentActivity.findMany({
      where: { vaultAddress: vault },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return { activities };
  },
});

const getApyHistoryTool = createTool({
  id: "getApyHistory",
  description: "Historical APY series for an asset (e.g. sUSDe, USDY, cmETH) over the last N days.",
  inputSchema: z.object({
    asset: z.string(),
    days: z.number().int().min(1).max(365).default(30),
  }),
  outputSchema: z.any(),
  execute: async ({ asset, days }) => ({ asset, history: await prismaApyReader.history(asset, days) }),
});

export const tendsTools = {
  listStrategies: listStrategiesTool,
  computeProjection: computeProjectionTool,
  readUserPosition: readUserPositionTool,
  getHoldings: getHoldingsTool,
  getAgentSettings: getAgentSettingsTool,
  getRecentActivity: getRecentActivityTool,
  getApyHistory: getApyHistoryTool,
};
