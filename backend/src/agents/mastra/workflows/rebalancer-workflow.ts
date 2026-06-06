import { createStep, createWorkflow } from "@mastra/core/workflows";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { childLogger } from "../../../lib/logger.js";
import { publicClient, getAgentWallet, activeChain } from "../../../chain/index.js";
import { addresses, as0x } from "../../../chain/addresses.js";
import { PRICE_FEED_ABI, ERC20_ABI, USER_VAULT_ABI } from "../../../chain/abis.js";
import { TOKENS, type TokenSymbol } from "../../../chain/tokens.js";
import { getAgentConfig } from "../../../services/agent-config.js";
import { currentApy } from "../../../services/projection.js";
import {
  buildStrategyPrompt,
  STRATEGY_SYSTEM_PROMPT,
  validateAllocation,
  repairAllocation,
  type HoldingItem,
} from "../../../services/strategy-prompt.js";
import {
  computeSwapInstructions,
  driftFloorWad,
  valueUsd,
  type TokenState,
} from "../../../services/rebalance-math.js";
import {
  defaultRebalancerDeps,
  SLIPPAGE_BPS,
  MIN_SWAP_USD,
} from "../../../services/rebalancer.js";
import { hermesModel } from "../hermes-model.js";
import { tendsMemory } from "../memory.js";
import { prisma } from "../../../db/client.js";
import { agentLogEmitter } from "../../../services/agent-log-emitter.js";

const log = childLogger("rebalancer-workflow");

// ── One-shot strategy decider — no tools, no memory, pure JSON allocation ──────
const hermesStrategyAgent = new Agent({
  id: "hermes-strategy-decider",
  name: "Hermes Strategy Decider",
  instructions: STRATEGY_SYSTEM_PROMPT,
  model: hermesModel,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function riskLevelFor(riskPreference: number, low: number, med: number, high: number): "LOW" | "MEDIUM" | "HIGH" {
  if (riskPreference === 0) return "LOW";
  if (riskPreference === 1) return "MEDIUM";
  if (riskPreference === 2) return "HIGH";
  // CUSTOM: dominant basket
  if (low >= med && low >= high) return "LOW";
  if (high >= low && high >= med) return "HIGH";
  return "MEDIUM";
}

/** Fetch all token balances + getPriceUnsafe prices for a vault. */
async function fetchTokenStates(vault: `0x${string}`): Promise<TokenState[]> {
  const pf = as0x(addresses.priceFeed);
  const results = await Promise.allSettled(
    Object.values(TOKENS)
      .filter((t) => t.address)
      .map(async (t) => {
        const [balance, [price]] = await Promise.all([
          publicClient.readContract({
            address: as0x(t.address),
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [vault],
          }),
          publicClient.readContract({
            address: pf,
            abi: PRICE_FEED_ABI,
            functionName: "getPriceUnsafe",
            args: [as0x(t.address)],
          }),
        ]);
        return {
          symbol: t.symbol,
          address: as0x(t.address),
          decimals: t.decimals,
          balance,
          price,
        } satisfies TokenState;
      }),
  );
  // Return successfully fetched tokens; skip RPC failures gracefully
  return results
    .filter((r): r is PromiseFulfilledResult<TokenState> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Shared Zod schemas ─────────────────────────────────────────────────────────

const holdingItemSchema = z.object({
  symbol: z.string(),
  valueUsd: z.number(),
  pct: z.number(),
});

// Step 1 output
const scanOutputSchema = z.object({
  vaultAddress: z.string(),
  riskPreference: z.number(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  userNotes: z.string(),
  proceed: z.boolean(),
  skipReason: z.string().optional(),
});

// Step 2 output extends step 1 with market data
const signalOutputSchema = scanOutputSchema.extend({
  prices: z.record(z.string(), z.number()),
  apy: z.record(z.string(), z.number()),
  holdings: z.array(holdingItemSchema),
  totalValueUsd: z.number(),
});

// Step 3 output: carries just what exec needs (drops large price/holdings maps)
const decideOutputSchema = z.object({
  vaultAddress: z.string(),
  riskPreference: z.number(),
  proceed: z.boolean(),
  skipReason: z.string().optional(),
  prices: z.record(z.string(), z.number()),
  allocation: z.record(z.string(), z.number()),
  reasoning: z.string(),
  attempts: z.number(),
});

// Step 4 (workflow) output
const execOutputSchema = z.object({
  vaultAddress: z.string(),
  outcome: z.any(),
  reasoning: z.string(),
  allocation: z.record(z.string(), z.number()),
  attempts: z.number(),
});

// ── Step 1: SCAN ───────────────────────────────────────────────────────────────
// Read vault meta + agent config; gate on pause/disabled/cooldown.
// Also pull user's investment context (AgentConfig notes + working memory profile).

const scanStep = createStep({
  id: "scan-vault",
  inputSchema: z.object({ vaultAddress: z.string() }),
  outputSchema: scanOutputSchema,
  execute: async ({ inputData }) => {
    const vault = as0x(inputData.vaultAddress);

    const [meta, config] = await Promise.all([
      defaultRebalancerDeps.readVaultMeta(vault),
      defaultRebalancerDeps.readAgentConfig(vault),
    ]);

    const now = defaultRebalancerDeps.now();

    const emitScan = (status: "skip" | "done" | "running", message: string, data?: Record<string, unknown>) =>
      agentLogEmitter.log({ vaultAddress: inputData.vaultAddress, workflow: "hermes-rebalancer", step: "scan-vault", status, message, data });

    emitScan("running", "Scanning vault status and guardrails...");

    if (meta.paused) {
      log.info({ vault }, "[scan] paused on-chain — skip");
      emitScan("skip", "Vault is paused on-chain");
      return { vaultAddress: inputData.vaultAddress, riskPreference: meta.riskPreference, riskLevel: "LOW" as const, userNotes: "", proceed: false, skipReason: "paused" };
    }
    if (!config.autoRebalanceEnabled) {
      log.info({ vault }, "[scan] auto-rebalance disabled — skip");
      emitScan("skip", "Auto-rebalance is disabled");
      return { vaultAddress: inputData.vaultAddress, riskPreference: meta.riskPreference, riskLevel: "LOW" as const, userNotes: "", proceed: false, skipReason: "disabled" };
    }
    if (now < meta.lastRebalanceTime + meta.minRebalanceInterval) {
      log.info({ vault }, "[scan] on-chain cooldown — skip");
      emitScan("skip", "On-chain cooldown not elapsed yet");
      return { vaultAddress: inputData.vaultAddress, riskPreference: meta.riskPreference, riskLevel: "LOW" as const, userNotes: "", proceed: false, skipReason: "cooldown" };
    }
    if (config.cadenceSec != null && now < meta.lastRebalanceTime + BigInt(config.cadenceSec)) {
      log.info({ vault }, "[scan] off-chain cadence — skip");
      emitScan("skip", "Off-chain cadence not elapsed yet");
      return { vaultAddress: inputData.vaultAddress, riskPreference: meta.riskPreference, riskLevel: "LOW" as const, userNotes: "", proceed: false, skipReason: "cooldown" };
    }
    if (config.dailyLimitPerDay != null) {
      const todayCount = await defaultRebalancerDeps.countTodayRebalances(vault);
      if (todayCount >= config.dailyLimitPerDay) {
        log.info({ vault }, "[scan] daily limit reached — skip");
        emitScan("skip", `Daily rebalance limit reached (${todayCount}/${config.dailyLimitPerDay})`);
        return { vaultAddress: inputData.vaultAddress, riskPreference: meta.riskPreference, riskLevel: "LOW" as const, userNotes: "", proceed: false, skipReason: "daily_limit" };
      }
    }

    // Resolve effective risk level (map CUSTOM to dominant bucket)
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
    if (meta.riskPreference === 3) {
      const [lowBps, medBps, highBps] = await publicClient.readContract({
        address: vault,
        abi: USER_VAULT_ABI,
        functionName: "customAllocation",
      });
      riskLevel = riskLevelFor(3, Number(lowBps), Number(medBps), Number(highBps));
    } else {
      riskLevel = riskLevelFor(meta.riskPreference, 0, 0, 0);
    }

    // ── Context-aware: pull user investment profile ──────────────────────────
    // AgentConfig.notes is the canonical investment policy set via app or chat.
    // We also try to fetch the user's working memory profile from past Hermes
    // conversations (resource-scoped, persists across chat threads).
    const contextParts: string[] = [];

    if (config.notes?.trim()) {
      contextParts.push(`Investment policy:\n${config.notes.trim()}`);
    }

    // Look up vault owner wallet for working memory retrieval
    try {
      const vaultRow = await prisma.vault.findFirst({ where: { address: vault } });
      if (vaultRow?.owner) {
        // Resource-scoped working memory: accumulated user profile from past chats.
        // Hermes fills this in during chat (risk tolerance, goals, preferred tokens, etc.)
        const wm = await tendsMemory.getWorkingMemory({
          threadId: "_rebalancer",
          resourceId: vaultRow.owner,
        });
        // Only include if Hermes has actually filled in any profile fields
        const hasContent = wm && /:\s*\S/.test(wm);
        if (hasContent) {
          contextParts.push(`User profile (from past conversations):\n${wm.trim()}`);
        }
      }
    } catch {
      // Working memory is optional — degrade gracefully
    }

    const userNotes = contextParts.join("\n\n");

    log.info({ vault, riskPreference: meta.riskPreference, riskLevel }, "[scan] proceed");
    emitScan("done", `Vault ready — ${riskLevel} risk mode`, { riskLevel, hasUserNotes: userNotes.length > 0 });
    return {
      vaultAddress: inputData.vaultAddress,
      riskPreference: meta.riskPreference,
      riskLevel,
      userNotes,
      proceed: true,
    };
  },
});

// ── Step 2: SIGNAL ─────────────────────────────────────────────────────────────
// Fetch live token prices (float USD) + vault holdings + APY estimates.
// This is the "tool call" equivalent from idx-playground: ground decisions in data.

const signalStep = createStep({
  id: "signal-market",
  inputSchema: scanOutputSchema,
  outputSchema: signalOutputSchema,
  execute: async ({ inputData }) => {
    const empty = { ...inputData, prices: {}, apy: {}, holdings: [], totalValueUsd: 0 };

    if (!inputData.proceed) return empty;

    const vault = as0x(inputData.vaultAddress);

    const emitSignal = (status: "running" | "skip" | "done" | "error", message: string, data?: Record<string, unknown>) =>
      agentLogEmitter.log({ vaultAddress: inputData.vaultAddress, workflow: "hermes-rebalancer", step: "signal-market", status, message, data });

    emitSignal("running", "Fetching live prices and portfolio state...");

    // Gate: check price freshness before planning
    const fresh = await defaultRebalancerDeps.arePricesFresh();
    if (!fresh) {
      log.warn({ vault }, "[signal] price feeds stale — skip");
      emitSignal("skip", "Price feeds are stale — cannot plan safely");
      return { ...empty, proceed: false, skipReason: "stale" };
    }

    // Fetch all token prices (unsafe: returns 0 for missing/stale feeds)
    const pf = as0x(addresses.priceFeed);
    const prices: Partial<Record<TokenSymbol, number>> = {};

    await Promise.all(
      Object.values(TOKENS)
        .filter((t) => t.address)
        .map(async (t) => {
          try {
            const [priceWad] = await publicClient.readContract({
              address: pf,
              abi: PRICE_FEED_ABI,
              functionName: "getPriceUnsafe",
              args: [as0x(t.address)],
            });
            if (priceWad > 0n) {
              prices[t.symbol] = Number(priceWad) / 1e18;
            }
          } catch {
            // Token has no feed entry — skip
          }
        }),
    );

    // Current holdings (symbols with balance > 0)
    const states = await fetchTokenStates(vault);
    const totalWad = states.reduce((sum, s) => sum + valueUsd(s), 0n);
    const totalValueUsd = Number(totalWad) / 1e18;

    const holdings: HoldingItem[] = states
      .filter((s) => s.balance > 0n && s.price > 0n)
      .map((s) => ({
        symbol: s.symbol,
        valueUsd: Number(valueUsd(s)) / 1e18,
        pct: totalWad > 0n ? (Number((valueUsd(s) * 10_000n) / totalWad) / 100) : 0,
      }));

    const apy = currentApy() as Record<string, number>;

    const liveCount = Object.keys(prices).length;
    log.info({ vault, tokens: liveCount, totalValueUsd: totalValueUsd.toFixed(2) }, "[signal] market data loaded");
    emitSignal("done", `Loaded ${liveCount} live prices — portfolio $${totalValueUsd.toFixed(2)}`, { liveCount, totalValueUsd });

    return {
      ...inputData,
      prices: prices as Record<string, number>,
      apy,
      holdings,
      totalValueUsd,
    };
  },
});

// ── Step 3: DECIDE ─────────────────────────────────────────────────────────────
// Hermes (LLM) decides the optimal allocation given full market context.
// Context-aware: user notes (AgentConfig + working memory) inform the decision.
// Validates output and retries up to 3 times with error feedback.

const decideStep = createStep({
  id: "decide-allocation",
  inputSchema: signalOutputSchema,
  outputSchema: decideOutputSchema,
  execute: async ({ inputData }) => {
    const skip = {
      vaultAddress: inputData.vaultAddress,
      riskPreference: inputData.riskPreference,
      proceed: false,
      skipReason: inputData.skipReason,
      prices: inputData.prices,
      allocation: {} as Record<string, number>,
      reasoning: "skipped",
      attempts: 0,
    };

    if (!inputData.proceed) return skip;

    const { riskLevel, holdings, prices, apy, totalValueUsd, userNotes } = inputData;
    const vault = inputData.vaultAddress;

    const emitDecide = (status: "running" | "done" | "error", message: string, data?: Record<string, unknown>) =>
      agentLogEmitter.log({ vaultAddress: vault, workflow: "hermes-rebalancer", step: "decide-allocation", status, message, data });

    emitDecide("running", `Hermes is analysing ${Object.keys(prices).length} tokens for ${riskLevel} risk...`);

    const userPrompt = buildStrategyPrompt({
      holdings: holdings as HoldingItem[],
      totalValueUsd,
      prices: prices as Partial<Record<TokenSymbol, number>>,
      apy: apy as Partial<Record<TokenSymbol, number>>,
      riskLevel,
      userNotes: userNotes || undefined,
    });

    let allocation: Record<string, number> = {};
    let reasoning = "";
    let attempts = 0;
    let lastErrors = "";

    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attempts = attempt;

      const prompt = lastErrors
        ? `${userPrompt}\n\n⚠️ Previous attempt failed validation:\n${lastErrors}\nFix ONLY these issues. Keep all other values. Sum MUST equal exactly 100. Return corrected JSON only.`
        : userPrompt;

      if (attempt > 1) {
        emitDecide("running", `Attempt ${attempt}/${MAX_ATTEMPTS} — fixing validation errors...`);
      }

      try {
        const result = await hermesStrategyAgent.generate([{ role: "user", content: prompt }]);
        const raw = await result.text;

        // Strip any accidental markdown fences
        const cleaned = raw.replace(/^```[\w]*\n?/m, "").replace(/```$/m, "").trim();
        const parsed = JSON.parse(cleaned) as { allocation: Record<string, number>; reasoning?: string };

        allocation = parsed.allocation ?? {};
        reasoning = parsed.reasoning ?? "";

        // Auto-repair minor arithmetic/cap errors before validation
        const repaired = repairAllocation(
          allocation,
          prices as Partial<Record<TokenSymbol, number>>,
          riskLevel,
        );

        const validation = validateAllocation(
          repaired,
          prices as Partial<Record<TokenSymbol, number>>,
          riskLevel,
        );

        if (validation.valid) {
          allocation = repaired;
          log.info({ vault, attempts, tokens: Object.keys(allocation).length }, "[decide] Hermes allocation validated ✓");
          break;
        }

        lastErrors = validation.errors.join("; ");
        log.warn({ vault, attempt, errors: validation.errors }, "[decide] allocation invalid — retry");
      } catch (e) {
        lastErrors = (e as Error).message;
        log.warn({ vault, attempt, err: lastErrors }, "[decide] LLM call failed — retry");
        allocation = {};
      }
    }

    // Final validation after all retries
    const finalCheck = validateAllocation(
      allocation,
      prices as Partial<Record<TokenSymbol, number>>,
      riskLevel,
    );

    if (!finalCheck.valid) {
      log.error({ vault, errors: finalCheck.errors }, "[decide] Hermes allocation invalid after max retries — fallback to skip");
      emitDecide("error", `Hermes allocation failed validation after ${attempts} attempt(s)`, { errors: finalCheck.errors });
      return { ...skip, proceed: false, skipReason: "llm_invalid", attempts, reasoning: `Failed: ${lastErrors}` };
    }

    emitDecide("done", `Hermes decided allocation in ${attempts} attempt(s)`, {
      reasoning,
      allocation,
      topTokens: Object.entries(allocation)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([sym, pct]) => `${sym} ${pct}%`)
        .join(", "),
    });

    return {
      vaultAddress: vault,
      riskPreference: inputData.riskPreference,
      proceed: true,
      prices: inputData.prices,
      allocation,
      reasoning,
      attempts,
    };
  },
});

// ── Step 4: EXEC ───────────────────────────────────────────────────────────────
// Convert Hermes allocation → SwapInstruction[]; simulate; execute on-chain.

const execStep = createStep({
  id: "exec-rebalance",
  inputSchema: decideOutputSchema,
  outputSchema: execOutputSchema,
  execute: async ({ inputData }) => {
    const base = {
      vaultAddress: inputData.vaultAddress,
      reasoning: inputData.reasoning,
      allocation: inputData.allocation,
      attempts: inputData.attempts,
    };

    const emitExec = (status: "running" | "skip" | "done" | "error", message: string, data?: Record<string, unknown>) =>
      agentLogEmitter.log({ vaultAddress: inputData.vaultAddress, workflow: "hermes-rebalancer", step: "exec-rebalance", status, message, data });

    if (!inputData.proceed || Object.keys(inputData.allocation).length === 0) {
      const reason = inputData.skipReason ?? "balanced";
      emitExec("skip", `No rebalance needed: ${reason}`);
      return {
        ...base,
        outcome: { action: "skip", reason },
      };
    }

    const vault = as0x(inputData.vaultAddress);

    emitExec("running", `Building swap instructions from Hermes allocation...`);

    // Convert Hermes allocation (%) to targetBps Map<TokenSymbol, number>
    const targetBps = new Map<TokenSymbol, number>();
    for (const [sym, pct] of Object.entries(inputData.allocation)) {
      if (pct > 0) targetBps.set(sym as TokenSymbol, Math.round(pct * 100));
    }

    // Re-fetch token states from chain for accurate current amounts
    const states = await fetchTokenStates(vault);

    // Apply drift threshold as dust floor
    const config = await defaultRebalancerDeps.readAgentConfig(vault);
    let minSwap = MIN_SWAP_USD;
    if (config.driftThresholdBps != null) {
      const totalWad = states.reduce((sum, s) => sum + valueUsd(s), 0n);
      const floor = driftFloorWad(config.driftThresholdBps, totalWad);
      if (floor > minSwap) minSwap = floor;
    }

    const instructions = computeSwapInstructions(states, targetBps, {
      slippageBps: config.maxSlippageBps ?? SLIPPAGE_BPS,
      minSwapValueUsd: minSwap,
    });

    if (instructions.length === 0) {
      log.info({ vault }, "[exec] already balanced after Hermes decision — skip");
      emitExec("skip", "Portfolio is already at target allocation");
      return { ...base, outcome: { action: "skip", reason: "balanced" } };
    }

    emitExec("running", `Simulating ${instructions.length} swap(s)...`);
    const simOk = await defaultRebalancerDeps.simulateRebalance(vault, instructions);
    if (!simOk) {
      log.warn({ vault, swaps: instructions.length }, "[exec] rebalance would revert (sim) — skip");
      emitExec("error", "Swap simulation failed — aborting to save gas");
      return { ...base, outcome: { action: "skip", reason: "unsafe" } };
    }

    // Stop-loss check before executing
    if (config.stopLossEnabled && config.stopLossPct != null) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [currentAssets, peakAssets] = await Promise.all([
        defaultRebalancerDeps.readTotalAssets(vault),
        defaultRebalancerDeps.readMaxRecentSnapshot(vault, sevenDaysAgo),
      ]);
      if (peakAssets != null && peakAssets > 0n && currentAssets < peakAssets) {
        const dropBps = ((peakAssets - currentAssets) * 10_000n) / peakAssets;
        if (dropBps >= BigInt(config.stopLossPct * 100)) {
          log.warn({ vault, dropBps: dropBps.toString() }, "[exec] stop-loss triggered — liquidating");
          const hash = await defaultRebalancerDeps.sendLiquidate(vault);
          await defaultRebalancerDeps.sendPause(vault, `stop-loss: -${config.stopLossPct}%`).catch(() => {});
          emitExec("done", `Stop-loss triggered (-${config.stopLossPct}%) — all positions liquidated`, { hash });
          return { ...base, outcome: { action: "liquidated", hash } };
        }
      }
    }

    emitExec("running", `Sending ${instructions.length} swap(s) on-chain...`);
    const hash = await defaultRebalancerDeps.sendRebalance(vault, instructions);
    log.info({ vault, hash, swaps: instructions.length, reasoning: inputData.reasoning }, "[exec] rebalanced by Hermes ✓");
    emitExec("done", `Rebalanced: ${instructions.length} swap(s) executed`, { hash, swaps: instructions.length, reasoning: inputData.reasoning });
    return { ...base, outcome: { action: "rebalanced", hash, swaps: instructions.length } };
  },
});

// ── Mastra Workflow ────────────────────────────────────────────────────────────

export const hermesRebalancerWorkflow = createWorkflow({
  id: "hermes-rebalancer",
  inputSchema: z.object({ vaultAddress: z.string() }),
  outputSchema: execOutputSchema,
})
  .then(scanStep)
  .then(signalStep)
  .then(decideStep)
  .then(execStep)
  .commit();

// ── Programmatic helper (scheduler / run-now button) ──────────────────────────

/**
 * Run the Hermes-driven rebalancer for a single vault. Steps are:
 *   SCAN (gate checks) → SIGNAL (market data) → DECIDE (LLM allocation) → EXEC (on-chain)
 *
 * Each step is observable in Mastra Studio under the "hermes-rebalancer" workflow.
 */
export async function runHermesRebalance(vaultAddress: string): Promise<{
  outcome: unknown;
  reasoning: string;
  allocation: Record<string, number>;
  attempts: number;
}> {
  const run = await hermesRebalancerWorkflow.createRun();
  const result = await run.start({ inputData: { vaultAddress } });

  if (result.status === "success") {
    const output = result.result as {
      outcome: unknown;
      reasoning: string;
      allocation: Record<string, number>;
      attempts: number;
    };
    return {
      outcome: output.outcome,
      reasoning: output.reasoning,
      allocation: output.allocation,
      attempts: output.attempts,
    };
  }

  const errMsg = result.status === "failed" ? result.error.message : result.status;
  log.error({ vaultAddress, status: result.status, err: errMsg }, "hermes rebalancer workflow did not succeed");
  return { outcome: { action: "skip", reason: result.status }, reasoning: errMsg, allocation: {}, attempts: 0 };
}
