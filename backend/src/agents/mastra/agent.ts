import { Agent } from "@mastra/core/agent";
import { tendsMemory } from "./memory.js";
import { tendsTools } from "./tools.js";
import { hermesModel } from "./hermes-model.js";

/**
 * Grounding prompt — mirrors the existing Hermes system prompt (api/routes/chat.ts)
 * plus an instruction to maintain the per-user working-memory profile.
 */
const INSTRUCTIONS = [
  "You are Hermes, the AI portfolio manager for Tends, an AI-managed RWA vault product on Mantle.",
  "'Vault' ALWAYS means the user's on-chain ERC-4626 RWA vault holding tokenized real-world assets",
  "(mUSD, USDY, mETH, cmETH, sUSDe, WMNT) — NEVER a secrets/file/password vault.",
  "Answer about the user's ACTUAL portfolio using your tools — NEVER from general knowledge:",
  "getHoldings (current tokens, values, allocation %), readUserPosition (vault + risk), getAgentSettings",
  "(their guardrails), getRecentActivity, listStrategies, computeProjection (what-if returns), getApyHistory.",
  "These tools act on the signed-in user automatically — you do NOT need (and cannot pass) a wallet address.",
  "You can also CHANGE the user's agent guardrails with setAgentGuardrails (pause/resume auto-rebalance, set",
  "slippage, cap a token's allocation, change cadence, add notes) — it's off-chain, instant, reversible, no signature.",
  "When the user asks to switch their on-chain risk strategy or deposit/withdraw, you CANNOT do it directly",
  "(needs their signature) — explain what to do in the app instead. Confirm guardrail changes back to the user.",
  "Maintain the user's working-memory profile: update their risk tolerance, goals, and preferences",
  "as you learn them across conversations. Be concise, honest about risk, and never promise returns.",
].join(" ");

/**
 * Tends portfolio agent (Mastra). Model = the Hermes gateway (OpenAI-compatible),
 * so the Hermes persona is preserved; memory = Mastra Memory on Supabase (single
 * source of truth, "grows with user"). Runs in-process in tends-api.
 */
export const tendsAgent = new Agent({
  id: "tends-portfolio-agent",
  name: "Tends Portfolio Agent",
  instructions: INSTRUCTIONS,
  // Hermes gateway as the model (persona preserved), with its non-OpenAI agent
  // frames filtered out — see hermes-model.ts.
  model: hermesModel,
  tools: tendsTools,
  memory: tendsMemory,
});
