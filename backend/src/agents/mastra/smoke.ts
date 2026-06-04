/**
 * PoC smoke test for the Mastra memory layer on Supabase. Proves the "grow with
 * user" property: working memory is RESOURCE-scoped, so a profile written in one
 * chat thread is visible from a DIFFERENT thread of the same user (wallet).
 *
 * Does NOT exercise the LLM (Hermes isn't running locally) — that's validated on
 * deploy where tends-api can reach tends-hermes. Run: pnpm tsx src/agents/mastra/smoke.ts
 */
import { tendsMemory } from "./memory.js";

const resourceId = "0x000000000000000000000000000000000000dEaD"; // throwaway test wallet
const threadA = "smoke-thread-a";
const threadB = "smoke-thread-b";

async function main() {
  console.log("1. creating thread (initializes Mastra tables on Supabase)…");
  await tendsMemory.createThread({ threadId: threadA, resourceId, title: "Smoke A" });

  console.log("2. writing resource-scoped working memory in thread A…");
  const profile =
    "# Tends User Profile\n- **Risk tolerance**: HIGH\n- **Goals**: maximize yield, ok with volatility\n";
  await tendsMemory.updateWorkingMemory({ threadId: threadA, resourceId, workingMemory: profile });

  const wmA = await tendsMemory.getWorkingMemory({ threadId: threadA, resourceId });
  console.log("   read back (thread A):", JSON.stringify(String(wmA ?? "").slice(0, 50)));

  console.log("3. reading from a DIFFERENT thread, SAME user (new session)…");
  await tendsMemory.createThread({ threadId: threadB, resourceId, title: "Smoke B" });
  const wmB = await tendsMemory.getWorkingMemory({ threadId: threadB, resourceId });
  console.log("   read back (thread B):", JSON.stringify(String(wmB ?? "").slice(0, 50)));

  const carried = String(wmB ?? "").includes("HIGH");
  console.log(
    carried
      ? "\n✅ RESOURCE-SCOPED MEMORY WORKS — profile carried across sessions on Supabase"
      : "\n❌ profile did NOT carry across threads",
  );
  process.exit(carried ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
