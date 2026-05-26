import "../lib/json-bigint.js"; // BigInt → string in JSON (tool results carry BigInt)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pino } from "pino";
import { formatUnits } from "viem";
import { prisma } from "../db/client.js";
import { prismaApyReader } from "../api/routes/apy.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { ERC20_ABI, PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";
import { valueUsd } from "../services/rebalance-math.js";
import { buildTools, type ToolDeps } from "./tools.js";

// stdio MCP uses STDOUT for the JSON-RPC protocol — logs MUST go to stderr.
const log = pino({ level: "info" }, process.stderr);

/** Read a vault's actual on-chain token holdings + USD values (human strings). */
async function readHoldings(vault: `0x${string}`) {
  const holdings: { symbol: string; balance: string; valueUsd: string }[] = [];
  let totalWad = 0n;
  for (const t of Object.values(TOKENS)) {
    if (!t.address) continue;
    const [balance, [price]] = await Promise.all([
      publicClient.readContract({ address: as0x(t.address), abi: ERC20_ABI, functionName: "balanceOf", args: [vault] }),
      publicClient.readContract({ address: as0x(addresses.priceFeed), abi: PRICE_FEED_ABI, functionName: "getPriceUnsafe", args: [as0x(t.address)] }),
    ]);
    if (balance === 0n) continue;
    const wad = valueUsd({ symbol: t.symbol, address: as0x(t.address), decimals: t.decimals, balance, price });
    totalWad += wad;
    holdings.push({ symbol: t.symbol, balance: formatUnits(balance, t.decimals), valueUsd: formatUnits(wad, 18) });
  }
  return { holdings, totalValueUsd: formatUnits(totalWad, 18) };
}

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
    if (!vault) return { vault: null, holdings: [], totalValueUsd: "0" };
    const { holdings, totalValueUsd } = await readHoldings(as0x(vault.address));
    return { vault, holdings, totalValueUsd }; // DB position + actual on-chain holdings
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
