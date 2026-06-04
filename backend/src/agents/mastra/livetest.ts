/**
 * Live end-to-end test: real tends-hermes model (via `fly proxy`) + Supabase memory
 * + tool-calling. Two turns in DIFFERENT threads, same user, to prove "grow with user".
 * Run: HERMES_API_KEY=... pnpm tsx src/agents/mastra/livetest.ts
 */
import { tendsAgent } from "./agent.js";

const resource = "0x00000000000000000000000000000000c0ffee01"; // throwaway test user
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
  // Turn 1 — state a preference + ask something that needs the listStrategies tool
  await turn(
    t1,
    "I'm a conservative investor — I prefer stablecoins and want to avoid volatility. What strategies do you offer?",
  );

  // Turn 2 — NEW thread, same user: does the agent recall the conservative profile?
  const r2 = await turn(
    t2,
    "Based on what you know about me, which single strategy fits me best? One word.",
  );

  const recalled = /low/i.test(r2);
  console.log(
    recalled
      ? "\n✅ GROW-WITH-USER: agent recalled the conservative profile across threads → recommended LOW"
      : "\n⚠️ check: agent reply didn't clearly recall the profile (read response above)",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("livetest failed:", e);
  process.exit(1);
});
