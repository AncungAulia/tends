import { Agent } from "@mastra/core/agent";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../../config/env.js";
import { tendsMemory } from "./memory.js";
import { tendsReadTools, tendsActionTools } from "./tools.js";

/**
 * Reliable tool-calling model (gpt-4o via GitHub Models) for the ACTION agent. Unlike
 * Hermes — which hallucinates write-tool success — gpt-4o actually invokes tools, so
 * this agent can DO things, not just advise. GitHub Models is plain OpenAI-compatible
 * (auth = a GitHub PAT with models:read).
 */
const actionModel = createOpenAICompatible({
  name: "github-models",
  baseURL: env.ACTION_AGENT_BASE_URL,
  apiKey: env.GITHUB_TOKEN,
}).chatModel(env.ACTION_AGENT_MODEL);

const INSTRUCTIONS = [
  "You are Hermes, the AI portfolio manager for Tends, an AI-managed RWA vault on Mantle.",
  "'Vault' = the user's on-chain ERC-4626 RWA vault (mUSD, USDY, mETH, cmETH, sUSDe, WMNT).",
  "You both ANSWER about and ACT on the signed-in user's portfolio — use your tools, never general knowledge.",
  "Read: getHoldings, readUserPosition, getAgentSettings, getRecentActivity, listStrategies, computeProjection, getApyHistory.",
  "Act: setAgentGuardrails changes the user's guardrails (pause/resume auto-rebalance, max slippage, per-token",
  "caps, cadence, drift, notes) — off-chain, instant, reversible, no signature.",
  "CRITICAL: to change a setting you MUST call setAgentGuardrails and report its ACTUAL result. Never claim a",
  "change you didn't make. Per-token caps are independent ceilings in bps (2500 = max 25%), NOT a strategy allocation.",
  "All tools act on the signed-in user automatically — you cannot pass a wallet address.",
  "On-chain actions (switch risk strategy, deposit, withdraw) need the user's signature — tell them to do it in the app.",
  "Maintain the user's working-memory profile (risk tolerance, goals, preferences). Be concise, honest about risk,",
  "never promise returns.",
].join(" ");

/**
 * Action-capable agent: reliable model (gpt-4o) + read AND mutating tools + Supabase
 * "grow with user" memory. Served at /api/chat-v2. Wallet is bound from the Privy
 * session via RequestContext (set in the route), never from the LLM.
 */
export const actionAgent = new Agent({
  id: "tends-action-agent",
  name: "Tends Action Agent",
  instructions: INSTRUCTIONS,
  model: actionModel,
  tools: { ...tendsReadTools, ...tendsActionTools },
  memory: tendsMemory,
});
