import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { childLogger } from "../lib/logger.js";

const log = childLogger("mcp");

/**
 * MCP server exposing Tends backend tools to the Hermes Agent.
 * Register in ~/.hermes/config.yaml:
 *
 *   mcp_servers:
 *     tends:
 *       command: "pnpm"
 *       args: ["--dir", "/abs/path/backend", "mcp"]
 *
 * Hermes registers each tool as `mcp_tends_<toolName>`.
 *
 * Tools to implement (docs/03-BACKEND_FRONTEND.md §A.3):
 *   readUserPosition, readAPYs, computeProjection,
 *   prepareDepositTx, prepareWithdrawTx, prepareSwitchTx,
 *   explainRisk, getAgentActivity,
 *   readVaultState, executeRebalance, readPriceFeeds,
 *   readDEXLiquidity, triggerEmergencyPause, logAlert
 */
const server = new McpServer({ name: "tends", version: "0.1.0" });

// Example tool — replace stub with real implementation.
server.tool(
  "readUserPosition",
  "Read a user's current portfolio position (shares, value, PnL).",
  { walletAddress: z.string().describe("User wallet address (0x...)") },
  async ({ walletAddress }) => {
    // TODO: query prisma.vault for this owner + enrich with on-chain value.
    log.info({ walletAddress }, "readUserPosition (stub)");
    return {
      content: [
        { type: "text", text: JSON.stringify({ walletAddress, positions: [] }) },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("Tends MCP server up (stdio)");
}

main().catch((err) => {
  log.error({ err }, "MCP server crashed");
  process.exit(1);
});
