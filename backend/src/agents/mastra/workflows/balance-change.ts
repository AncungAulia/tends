import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { childLogger } from "../../../lib/logger.js";
import { as0x } from "../../../chain/addresses.js";
import { rebalancerService } from "../../../services/rebalancer.js";

const log = childLogger("balance-change");

/**
 * React to a deposit/withdraw: rebalance the vault toward its target now (deploy the
 * new deposit / rebalance the remainder). Deterministic — no LLM. processVault keeps
 * all guardrails (pause/disabled/stale/cooldown/caps) + budget-cap + simulate-guard,
 * so it's safe and never burns gas on a revert. The indexer wires this on the on-chain
 * Deposit/Withdraw events (see services/indexer.ts); these workflows also expose it in
 * Studio so the reaction can be run + traced visually.
 */
export async function rebalanceAfterBalanceChange(
  vault: string,
  reason: "deposit" | "withdraw",
): Promise<unknown> {
  log.info({ vault, reason }, "balance change — rebalancing toward target");
  return rebalancerService.processVault(as0x(vault));
}

function makeBalanceWorkflow(id: string, reason: "deposit" | "withdraw") {
  const step = createStep({
    id: `rebalance-after-${reason}`,
    inputSchema: z.object({ vaultAddress: z.string() }),
    outputSchema: z.object({ outcome: z.any() }),
    execute: async ({ inputData }) => ({
      outcome: await rebalanceAfterBalanceChange(inputData.vaultAddress, reason),
    }),
  });
  return createWorkflow({
    id,
    inputSchema: z.object({ vaultAddress: z.string() }),
    outputSchema: z.object({ outcome: z.any() }),
  })
    .then(step)
    .commit();
}

export const onDepositWorkflow = makeBalanceWorkflow("on-deposit", "deposit");
export const onWithdrawWorkflow = makeBalanceWorkflow("on-withdraw", "withdraw");
