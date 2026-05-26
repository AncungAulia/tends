import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pino } from "pino";
import { prisma } from "../db/client.js";
import { prismaApyReader } from "../api/routes/apy.js";
import { buildTools, type ToolDeps } from "./tools.js";

// stdio MCP uses STDOUT for the JSON-RPC protocol — logs MUST go to stderr.
const log = pino({ level: "info" }, process.stderr);

/**
 * Tends MCP server (stdio). Hermes spawns this as a subprocess and exposes its
 * tools as `mcp_tends_<tool>`. Register in ~/.hermes/config.yaml:
 *
 *   mcp_servers:
 *     tends:
 *       command: "node"
 *       args: ["/app/dist/mcp/server.js"]
 *       env: { DATABASE_URL: "...", VAULT_FACTORY_ADDRESS: "...", ... }
 */
const deps: ToolDeps = {
  async position(walletAddress) {
    const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
    return { vault };
  },
  async activity(walletAddress) {
    const vault = await prisma.vault.findUnique({ where: { owner: walletAddress } });
    if (!vault) return { activities: [] };
    const activities = await prisma.agentActivity.findMany({
      where: { vaultAddress: vault.address },
      orderBy: { timestamp: "desc" },
      take: 20,
    });
    return { activities };
  },
  apyHistory: (asset, days) => prismaApyReader.history(asset, days),
};

const server = new McpServer({ name: "tends", version: "0.1.0" });
for (const t of buildTools(deps)) {
  // SDK validates against t.schema before calling; our handler re-parses defensively.
  server.tool(t.name, t.description, t.schema, t.handler as never);
}

async function main() {
  await server.connect(new StdioServerTransport());
  log.info(`Tends MCP server up (stdio) — ${buildTools(deps).length} tools`);
}

main().catch((err) => {
  log.error({ err }, "MCP server crashed");
  process.exit(1);
});
