import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { childLogger } from "../../../lib/logger.js";
import { as0x } from "../../../chain/addresses.js";
import { getAgentConfig } from "../../../services/agent-config.js";
import { readHoldings } from "../../../services/holdings.js";
import { rebalancerService } from "../../../services/rebalancer.js";

const log = childLogger("enforce-guardrails");

/**
 * Pure: token symbols whose CURRENT allocation (%) exceeds their cap (bps).
 * cap 2500 bps = 25%; a holding at 30% → violation.
 */
export function findCapViolations(
  holdings: { symbol: string; allocationPct: number }[],
  caps: Partial<Record<string, number>> | null | undefined,
): string[] {
  if (!caps) return [];
  return holdings
    .filter((h) => {
      const cap = caps[h.symbol];
      return cap != null && h.allocationPct > cap / 100;
    })
    .map((h) => h.symbol);
}

export interface EnforceResult {
  enforced: boolean;
  violations: string[];
  outcome: unknown;
}

/**
 * Deterministic reaction to a guardrail change: if the user's new per-token caps are
 * now violated by their current allocation, rebalance to bring it back in bounds
 * (buildInstructions clamps the target to the caps). Always runs — no LLM, so it's
 * 100% reliable (unlike a chat-tool the model might skip). Triggered fire-and-forget
 * from POST /agent-config; also exposed as a Mastra workflow for Studio observability.
 */
export async function enforceGuardrails(vaultAddress: string): Promise<EnforceResult> {
  const config = await getAgentConfig(vaultAddress);
  if (!config.autoRebalanceEnabled || !config.perTokenCapsBps) {
    return { enforced: false, violations: [], outcome: null };
  }
  const { holdings } = await readHoldings(as0x(vaultAddress));
  const violations = findCapViolations(holdings, config.perTokenCapsBps);
  if (violations.length === 0) return { enforced: false, violations: [], outcome: null };

  log.info({ vaultAddress, violations }, "guardrail caps violated — enforcing via rebalance");
  const outcome = await rebalancerService.runNow(as0x(vaultAddress));
  return { enforced: true, violations, outcome };
}

// ── Mastra workflow wrapper (Studio traces + the event-driven pattern) ────────

const assessStep = createStep({
  id: "assess-caps",
  inputSchema: z.object({ vaultAddress: z.string() }),
  outputSchema: z.object({
    vaultAddress: z.string(),
    violations: z.array(z.string()),
    needsRebalance: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const config = await getAgentConfig(inputData.vaultAddress);
    if (!config.autoRebalanceEnabled || !config.perTokenCapsBps) {
      return { vaultAddress: inputData.vaultAddress, violations: [], needsRebalance: false };
    }
    const { holdings } = await readHoldings(as0x(inputData.vaultAddress));
    const violations = findCapViolations(holdings, config.perTokenCapsBps);
    return { vaultAddress: inputData.vaultAddress, violations, needsRebalance: violations.length > 0 };
  },
});

const enforceStep = createStep({
  id: "enforce",
  inputSchema: z.object({
    vaultAddress: z.string(),
    violations: z.array(z.string()),
    needsRebalance: z.boolean(),
  }),
  outputSchema: z.object({ enforced: z.boolean(), violations: z.array(z.string()), outcome: z.any() }),
  execute: async ({ inputData }) => {
    if (!inputData.needsRebalance) {
      return { enforced: false, violations: inputData.violations, outcome: null };
    }
    const outcome = await rebalancerService.runNow(as0x(inputData.vaultAddress));
    return { enforced: true, violations: inputData.violations, outcome };
  },
});

export const enforceGuardrailsWorkflow = createWorkflow({
  id: "enforce-guardrails",
  inputSchema: z.object({ vaultAddress: z.string() }),
  outputSchema: z.object({ enforced: z.boolean(), violations: z.array(z.string()), outcome: z.any() }),
})
  .then(assessStep)
  .then(enforceStep)
  .commit();
