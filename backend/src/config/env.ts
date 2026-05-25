import { existsSync } from "node:fs";
import { z } from "zod";

// Load .env for local dev/test. In production, real env vars are already set.
// process.loadEnvFile is available in Node 20.12+/22+.
if (process.env.NODE_ENV !== "production" && existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore — fall back to ambient process.env
  }
}

const addr = () => z.string().default("");

/** Single source of truth for runtime config. Fails fast on boot if invalid. */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // ── Chain (Mantle) ──────────────────────────────────────────────────────
  CHAIN_ID: z.coerce.number().int().positive().default(5003),
  MANTLE_RPC_URL: z.string().url(),
  MANTLE_RPC_URL_FALLBACK: z.string().url().optional().or(z.literal("")),

  // Backend-controlled EOAs. AGENT_EXECUTOR signs pushPrices() + rebalance() —
  // its ADDRESS must be authorized in the contracts by the SC team (Axel).
  // (The SC integration guide calls this AGENT_EXECUTOR_PRIVATE_KEY.)
  PRIVATE_KEY_AGENT_EXECUTOR: z.string().default(""),
  PRIVATE_KEY_GAS_FUNDER: z.string().default(""),

  // ── Contracts (per-user-vault architecture; see backend/INTEGRATION.md) ───
  USE_MOCK_CONTRACTS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  VAULT_FACTORY_ADDRESS: addr(),
  PRICE_FEED_ADDRESS: addr(),
  ACTIVITY_LOG_ADDRESS: addr(),
  STRATEGY_ROUTER_ADDRESS: addr(),
  // MockOracle is already live on Mantle Sepolia.
  MOCK_ORACLE_ADDRESS: z
    .string()
    .default("0x26f9178b4082b68D8cC55874D377f9829Fc8C22d"),

  // ── Token addresses (mocks on testnet) ────────────────────────────────────
  USDC_ADDR: addr(),
  MUSD_ADDR: addr(),
  USDY_ADDR: addr(),
  METH_ADDR: addr(),
  CMETH_ADDR: addr(),
  SUSDE_ADDR: addr(),
  WMNT_ADDR: addr(),

  // ── Price relayer (handed off to backend — RELAYER-HANDOFF.md) ────────────
  // Pushes RedStone + Ondo USDY prices into MockOracle. Signed by AGENT_EXECUTOR
  // (already setRelayer on MockOracle). Always-on when RELAYER_ENABLED.
  RELAYER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  RELAYER_INTERVAL_SEC: z.coerce.number().int().positive().default(3600),
  REDSTONE_DATA_SERVICE_ID: z.string().default("redstone-primary-prod"),

  // Rebalance agent loop (sends rebalance txs) + price freshness monitor.
  REBALANCER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  REBALANCER_INTERVAL_SEC: z.coerce.number().int().positive().default(3600),
  PRICE_MONITOR_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PRICE_MONITOR_INTERVAL_SEC: z.coerce.number().int().positive().default(600),

  // Indexer: live event watch (VaultDeployed/ActivityLogged) + APY snapshot scraper.
  INDEXER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APY_SCRAPER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APY_SCRAPER_INTERVAL_SEC: z.coerce.number().int().positive().default(300),
  // Ondo USDY oracle lives on Mantle MAINNET, so the relayer needs a mainnet RPC.
  MANTLE_MAINNET_RPC: z.string().url().default("https://rpc.mantle.xyz"),
  USDY_ORACLE_ADDRESS: z
    .string()
    .default("0xA96abbe61AfEdEB0D14a20440Ae7100D9aB4882f"),

  // ── Hermes Agent (sidecar — `hermes gateway`, OpenAI-compatible) ──────────
  HERMES_BASE_URL: z.string().url().default("http://127.0.0.1:8642/v1"),
  HERMES_API_KEY: z.string().default("change-me-local-dev"),
  HERMES_MODEL: z.string().default("hermes-agent"),
  OPENROUTER_KEY: z.string().default(""),
  LLM_MODEL: z.string().default("anthropic/claude-sonnet-4.6"),

  // ── Privy / pricing / mcp ─────────────────────────────────────────────────
  PRIVY_APP_ID: z.string().default(""),
  PRIVY_APP_SECRET: z.string().default(""),
  // Privy app verification public key (SPKI PEM, ES256) from the dashboard.
  PRIVY_VERIFICATION_KEY: z.string().default(""),
  PRIVY_JWT_ISSUER: z.string().default("privy.io"),
  COINGECKO_API_KEY: z.string().default(""),
  MCP_PORT: z.coerce.number().int().positive().default(8765),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment variables:\n",
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";
