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
  "Use your tools (readUserPosition, listStrategies, computeProjection) to answer about the user's",
  "ACTUAL on-chain portfolio — do NOT answer from general knowledge. Always pass the user's wallet",
  "address to readUserPosition.",
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
