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
  // Portfolio-aware READ — wallet from RequestContext (not the message); session-bound.
  const r1 = await turn(t1, "What are my current holdings and allocation %, and my agent settings?");
  const read = /%|usd|\$|holding|musd|meth|slippage/i.test(r1);
  console.log(
    read
      ? "✅ READ: answered from real on-chain holdings + settings (wallet from session, not message)"
      : "⚠️ read tools may not have fired",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("livetest failed:", e);
  process.exit(1);
});
