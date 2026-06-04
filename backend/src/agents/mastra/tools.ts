import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { listStrategies, riskLevelFromId } from "../../strategies.js";
import { projectForRisk } from "../../services/projection.js";
import { prisma } from "../../db/client.js";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid wallet address");
const strategyId = z.enum(["LOW", "MEDIUM", "HIGH", "CUSTOM"]);

/**
 * PoC subset of the portfolio tools, ported from src/mcp/tools.ts to native Mastra
 * tools. Same pure services — listStrategies / projectForRisk — so behaviour matches
 * the existing Hermes-MCP path. (Full migration ports all 8 + on-chain holdings.)
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
    capital: z.number().positive().describe("USD principal to invest"),
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
    "Read the user's on-chain Tends vault (deployed address, risk preference, deposit). Pass the user's wallet address.",
  inputSchema: z.object({ walletAddress: address }),
  outputSchema: z.any(),
  execute: async ({ walletAddress }) => {
    const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
    return vault ? { vault } : { vault: null, note: "no vault deployed yet" };
  },
});

export const tendsTools = {
  listStrategies: listStrategiesTool,
  computeProjection: computeProjectionTool,
  readUserPosition: readUserPositionTool,
};
