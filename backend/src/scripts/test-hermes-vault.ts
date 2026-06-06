/**
 * Direct Hermes rebalancer test on the deployer's vault.
 * Runs the full SCAN → SIGNAL → DECIDE → EXEC workflow.
 *
 *   fly ssh console --app tends-api -C "node dist/scripts/test-hermes-vault.js"
 */

import { runHermesRebalance } from "../agents/mastra/workflows/rebalancer-workflow.js";
import { agentLogEmitter } from "../services/agent-log-emitter.js";

const VAULT = "0xc6667F8aCd202EF42a34C68dC858761C53A8eD72";

// Stream every log entry to stdout so we can see all steps live
agentLogEmitter.on("entry", (entry) => {
  const ts = new Date(entry.ts).toISOString().slice(11, 19);
  const status = entry.status.toUpperCase().padEnd(7);
  const step   = entry.step.padEnd(20);
  console.log(`[${ts}] ${status} ${step} ${entry.message}`);
  if (entry.data && Object.keys(entry.data).length > 0) {
    const relevant = Object.fromEntries(
      Object.entries(entry.data).filter(([k]) =>
        ["allocation", "reasoning", "topTokens", "hash", "liveCount", "totalValueUsd", "riskLevel", "errors"].includes(k)
      )
    );
    if (Object.keys(relevant).length > 0) {
      console.log("         →", JSON.stringify(relevant, null, 2).split("\n").join("\n           "));
    }
  }
});

async function main() {
  console.log("=".repeat(70));
  console.log(`Hermes rebalance test — vault: ${VAULT}`);
  console.log("=".repeat(70));
  console.log();

  const result = await runHermesRebalance(VAULT);

  console.log();
  console.log("=".repeat(70));
  console.log("FINAL RESULT");
  console.log("=".repeat(70));
  console.log("Outcome   :", JSON.stringify(result.outcome));
  console.log("Attempts  :", result.attempts);
  console.log("Reasoning :", result.reasoning);

  if (Object.keys(result.allocation).length > 0) {
    console.log("\nFinal allocation:");
    console.log(
      "  " + ["Token".padEnd(12), "Alloc%"].join("")
    );
    console.log("  " + "-".repeat(20));
    for (const [sym, pct] of Object.entries(result.allocation).sort(([,a],[,b]) => b - a)) {
      console.log("  " + sym.padEnd(12) + pct + "%");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
