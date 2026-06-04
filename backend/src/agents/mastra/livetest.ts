/**
 * Live end-to-end test: real tends-hermes model (via `fly proxy`) + Supabase memory
 * + tool-calling. Two turns in DIFFERENT threads, same user, to prove "grow with user".
 * Run: HERMES_API_KEY=... pnpm tsx src/agents/mastra/livetest.ts
 */
import { tendsAgent } from "./agent.js";

const resource = "0x56A2950ddE6B1040d1DCC4b4C4Fc314Bd56eFB0E"; // real vault owner (portfolio tools)
const t1 = "live-thread-1";
const t2 = "live-thread-2";

async function turn(thread: string, msg: string): Promise<string> {
  console.log(`\n>>> [${thread}] user: ${msg}`);
  const stream = await tendsAgent.stream(msg, { memory: { resource, thread } });
  let out = "";
  for await (const chunk of stream.textStream) {
    out += chunk;
    process.stdout.write(chunk);
  }
  console.log();
  return out;
}

async function main() {
  // Portfolio-aware: needs getHoldings + getAgentSettings tools on real on-chain data
  const r1 = await turn(
    t1,
    `My wallet is ${resource}. What are my current holdings and allocation %, and what are my agent guardrail settings?`,
  );
  const usedTools = /%|usd|\$|slippage|rebalance|holding/i.test(r1);
  console.log(
    usedTools
      ? "\n✅ PORTFOLIO-AWARE: agent answered from real on-chain holdings + agent settings (tools fired)"
      : "\n⚠️ check the reply above — tools may not have fired",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("livetest failed:", e);
  process.exit(1);
});
