import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { Observability, MastraStorageExporter, SensitiveDataFilter } from "@mastra/observability";
import { env } from "../config/env.js";
import { tendsAgent } from "../agents/mastra/agent.js";
import { enforceGuardrailsWorkflow } from "../agents/mastra/workflows/enforce-guardrails.js";
import { onDepositWorkflow, onWithdrawWorkflow } from "../agents/mastra/workflows/balance-change.js";

/**
 * Mastra instance — ONLY for local Studio (`pnpm studio` → http://localhost:4111).
 * The production agent runs embedded in the Hono app (api/routes/chat-v2.ts); this
 * registration exists so `mastra dev` can discover the agent for visual testing,
 * tracing, and tool inspection. Not imported by the server.
 *
 * Studio talks to the agent's real Supabase memory; to actually chat, the Hermes
 * model must be reachable — run `fly proxy 8642 -a tends-hermes` first.
 */
const connectionString = env.DIRECT_URL || env.DATABASE_URL;

export const mastra = new Mastra({
  agents: { tendsAgent },
  workflows: { enforceGuardrailsWorkflow, onDepositWorkflow, onWithdrawWorkflow },
  // Pin Studio to 4111 so it doesn't grab the app's PORT (3001 from .env).
  server: { port: 4111 },
  // Storage powers Studio's Observability tab (traces + logs). On Supabase,
  // schema 'mastra', bounded pool for the session pooler.
  // NOTE: the Metrics sub-tab needs an OLAP store (DuckDB/ClickHouse) — Postgres
  // covers Traces + Logs only.
  storage: new PostgresStore({
    id: "tends-observability",
    connectionString,
    schemaName: "mastra",
    max: 3,
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "tends",
        exporters: [new MastraStorageExporter()], // persist traces/logs to the storage above
        spanOutputProcessors: [new SensitiveDataFilter()], // redact secrets from spans
      },
    },
  }),
});
