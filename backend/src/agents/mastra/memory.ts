import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import { env } from "../../config/env.js";

/**
 * Mastra agent memory, persisted on Supabase (the "grow with user" store).
 *
 * Uses the DIRECT (non-pooled, :5432) connection: Supabase's pgBouncer transaction
 * pooler (:6543) doesn't support the session features / advisory locks the store
 * needs. Falls back to DATABASE_URL on a non-pooled Postgres.
 */
const connectionString = env.DIRECT_URL || env.DATABASE_URL;

/** Markdown skeleton the agent keeps up to date per user. */
const WORKING_MEMORY_TEMPLATE = `# Tends User Profile
- **Risk tolerance**:
- **Goals**:
- **Preferred / avoided tokens**:
- **Recurring questions / interests**:
- **Communication style**:
`;

/**
 * Working memory is RESOURCE-scoped (resource = the user's wallet address), so the
 * evolving profile persists across EVERY chat thread/session for that user — this is
 * the "grow with user" behaviour. Semantic recall is off for the PoC (needs an
 * embedder + pgvector); add it in the full migration.
 */
export const tendsMemory = new Memory({
  // Supabase's session pooler caps clients at pool_size 15 — keep Mastra's pool
  // small so init (which creates ~10 tables) doesn't exhaust it. Mastra needs
  // session mode (LISTEN/NOTIFY: mastra_notifications), so the 6543 txn pooler is out.
  storage: new PostgresStore({
    id: "tends-memory",
    connectionString,
    schemaName: "mastra", // keep Mastra's ~34 tables in their own schema, off `public`
    max: 3,
    idleTimeoutMillis: 10_000,
  }),
  options: {
    lastMessages: 20,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
      scope: "resource",
      template: WORKING_MEMORY_TEMPLATE,
    },
  },
});
