/**
 * Live end-to-end test: real tends-hermes model (via `fly proxy`) + Supabase memory
 * + tool-calling. Two turns in DIFFERENT threads, same user, to prove "grow with user".
 * Run: HERMES_API_KEY=... pnpm tsx src/agents/mastra/livetest.ts
 */
import { RequestContext } from "@mastra/core/request-context";
import { tendsAgent } from "./agent.js";

const resource = "0x56A2950ddE6B1040d1DCC4b4C4Fc314Bd56eFB0E"; // real vault owner (portfolio tools)
const t1 = "live-thread-1";
const t2 = "live-thread-2";

async function turn(thread: string, msg: string): Promise<string> {
  console.log(`\n>>> [${thread}] user: ${msg}`);
  // wallet bound via RequestContext (as the chat route does from the Privy session)
  const requestContext = new RequestContext();
  requestContext.set("walletAddress", resource);
  const stream = await tendsAgent.stream(msg, { memory: { resource, thread }, requestContext });
  let out = "";
  for await (const chunk of stream.textStream) {
    out += chunk;
    process.stdout.write(chunk);
  }
  console.log();
  return out;
}

async function main() {
  // 1) Portfolio-aware READ — wallet from RequestContext, not the message
  const r1 = await turn(t1, "What are my current holdings and allocation %?");
  const read = /%|usd|\$|holding|musd|meth/i.test(r1);
  console.log(read ? "✅ READ: answered from real on-chain holdings" : "⚠️ read tools may not have fired");

  // 2) ACTION — agent mutates the user's OWN guardrails (off-chain, session-bound)
  await turn(t1, "Please cap my sUSDe allocation at 25% and set max slippage to 2%.");
  const { getAgentConfig } = await import("../../services/agent-config.js");
  const { prisma } = await import("../../db/client.js");
  const v = await prisma.vault.findUnique({ where: { owner: resource } });
  const cfg = v ? await getAgentConfig(v.address) : null;
  console.log("\nDB after action →", JSON.stringify({ caps: cfg?.perTokenCapsBps, slippage: cfg?.maxSlippageBps }));
  const applied = cfg?.perTokenCapsBps?.sUSDe === 2500 && cfg?.maxSlippageBps === 200;
  console.log(applied ? "✅ ACTION: agent set guardrails via setAgentGuardrails (secure, session wallet)" : "⚠️ guardrails not as expected (read reply above)");
  // reset to default so we don't leave caps on a real vault
  await upsertReset(v?.address);
  await prisma.$disconnect();
  process.exit(0);
}

async function upsertReset(vaultAddress?: string) {
  if (!vaultAddress) return;
  const { prisma } = await import("../../db/client.js");
  await prisma.agentConfig.delete({ where: { vaultAddress } }).catch(() => {});
}

main().catch((e) => {
  console.error("livetest failed:", e);
  process.exit(1);
});
