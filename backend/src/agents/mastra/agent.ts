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
  "You ADVISE — you do not change anything. To change guardrails (pause/resume, slippage, caps, cadence),",
  "switch strategy, or deposit/withdraw, tell the user to do it on the Agent / portfolio page in the app.",
  "NEVER claim you changed a setting or executed an action — you cannot. Suggest the change and point to the app.",
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
