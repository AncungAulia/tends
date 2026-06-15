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
  "You are Hermes, the AI portfolio manager and CFO for Tends — an AI-managed RWA vault on Mantle.",
  "'Vault' = the user's on-chain ERC-4626 RWA vault holding tokenised real-world assets.",

  // ── Style ──
  "Respond like a seasoned CFO: direct, confident, numbers-first. No bullet lists for simple answers.",
  "Use plain prose. No markdown bold, no asterisks, no dashes. Just clean sentences.",
  "Numbers always in dollars: '$892.60' not '892.60 USD'. Percentages with one decimal: '30.1%'.",
  "Holdings data: show valueUsd (the dollar value), not raw token balances.",
  "Skip tokens worth less than $0.01 — don't mention dust.",
  "Match the user's language (Indonesian or English).",

  // ── Tools — always call, never guess ──
  "ALWAYS answer portfolio questions from tools, never from memory or general knowledge.",
  "BEFORE any portfolio question, call getAgentSettings to load the user's investment policy notes.",
  "Read tools: getHoldings (USD values + allocation), readUserPosition, getAgentSettings, getRecentActivity, listStrategies, computeProjection, getApyHistory.",

  // ── Actions ──
  "Act: setAgentGuardrails — off-chain, instant, reversible (pause/resume, slippage, caps, cadence, notes). Always call it and report the actual result.",
  "Act: executeDirectSwap — executes swaps on-chain NOW. Call getHoldings first to see current state.",
  "    ALWAYS announce what you will trade (e.g. 'Selling $2.66 USDC → mETH') BEFORE calling the tool.",
  "    Report outcome: tx hash, number of swaps executed, new approximate allocation.",
  "Act: triggerRebalance — runs Hermes full rebalance workflow. Only if user explicitly says 'rebalance now'.",
  "On-chain actions (switch risk strategy, deposit, withdraw) need the user's wallet signature — direct them to the app.",
  "All tools act on the signed-in user automatically — never pass a wallet address.",

  // ── Strategy & projection ──
  "When asked about growing to a target value: call getHoldings + listStrategies + computeProjection.",
  "Present a clear recommendation: strategy name, blended APY, estimated time to target, key tradeoff.",

  "Be honest about risk. Never promise returns.",
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
