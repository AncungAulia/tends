import { Mastra } from "@mastra/core";
import { tendsAgent } from "../agents/mastra/agent.js";

/**
 * Mastra instance — ONLY for local Studio (`pnpm studio` → http://localhost:4111).
 * The production agent runs embedded in the Hono app (api/routes/chat-v2.ts); this
 * registration exists so `mastra dev` can discover the agent for visual testing,
 * tracing, and tool inspection. Not imported by the server.
 *
 * Studio talks to the agent's real Supabase memory; to actually chat, the Hermes
 * model must be reachable — run `fly proxy 8642 -a tends-hermes` first.
 */
export const mastra = new Mastra({
  agents: { tendsAgent },
  // Pin Studio to 4111 so it doesn't grab the app's PORT (3001 from .env).
  server: { port: 4111 },
});
