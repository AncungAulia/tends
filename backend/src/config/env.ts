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
  // Direct (non-pooled) DB connection for `prisma migrate deploy` — read by the
  // Prisma CLI, not the running app. Required once schema.prisma references it
  // (on a non-pooled Postgres, set it to the same value as DATABASE_URL).
  DIRECT_URL: z.string().url().optional().or(z.literal("")),
  // Optional — Redis isn't consumed yet (reserved for cache/rate-limit). No need
  // to provision it to deploy.
  REDIS_URL: z.string().url().optional().or(z.literal("")),

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
  // Crypto / stable
  USDC_ADDR:  addr(),
  MUSD_ADDR:  addr(),
  USDY_ADDR:  addr(),
  METH_ADDR:  addr(),
  CMETH_ADDR: addr(),
  SUSDE_ADDR: addr(),
  WMNT_ADDR:  addr(),
  // Stable funds (money-market / T-bill NAV ≈ $1)
  BENJI_ADDR: addr(),
  BUIDL_ADDR: addr(),
  VBILL_ADDR: addr(),
  // Bonds / credit
  CETES_ADDR:   addr(),
  GILTS_ADDR:   addr(),
  KTB_ADDR:     addr(),
  TESOURO_ADDR: addr(),
  ACRED_ADDR:   addr(),
  ONDO_ADDR:    addr(),
  // Gold & precious metals
  XAU_ADDR:  addr(),
  XAUT_ADDR: addr(),
  XAG_ADDR:  addr(),
  XPT_ADDR:  addr(),
  // Commodities
  WTI_ADDR:     addr(),
  XCU_ADDR:     addr(),
  URANIUM_ADDR: addr(),
  // Equity indices
  USA500_ADDR:    addr(),
  USA100_ADDR:    addr(),
  KOSPI200_ADDR:  addr(),
  NIKKEI225_ADDR: addr(),
  // Stocks
  AAPL_ADDR:  addr(),
  AMZN_ADDR:  addr(),
  GOOGL_ADDR: addr(),
  META_ADDR:  addr(),
  MSFT_ADDR:  addr(),
  NVDA_ADDR:  addr(),
  PLTR_ADDR:  addr(),
  TSLA_ADDR:  addr(),
  // FX Major
  EUR_ADDR: addr(),
  GBP_ADDR: addr(),
  SGD_ADDR: addr(),
  // FX EM
  BRL_ADDR: addr(),
  IDR_ADDR: addr(),
  JPY_ADDR: addr(),
  KRW_ADDR: addr(),
  TRY_ADDR: addr(),

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
  // Auto-pause every vault when a token breaches its price floor (depeg). Off by
  // default — a transient blip shouldn't mass-pause; flip on once thresholds are tuned.
  RISK_AUTOPAUSE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APY_SCRAPER_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  APY_SCRAPER_INTERVAL_SEC: z.coerce.number().int().positive().default(300),
  // PnL snapshotter: records each vault's totalAssets() over time (FE PnL chart).
  PNL_SNAPSHOT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PNL_SNAPSHOT_INTERVAL_SEC: z.coerce.number().int().positive().default(3600),
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
  OPENROUTER_API_KEY: z.string().default(""),
  // Reliable model for the ACTION agent (gpt-4o via GitHub Models) — calls tools
  // properly, unlike Hermes which hallucinates write-tool success.
  GITHUB_TOKEN: z.string().default(""), // PAT with models:read
  ACTION_AGENT_BASE_URL: z.string().url().default("https://models.github.ai/inference"),
  ACTION_AGENT_MODEL: z.string().default("openai/gpt-4o"),
  // Read+advisory chat (/api/chat). Runs on GitHub Models too — bypasses the Hermes
  // gateway, which hardcodes copilot/gpt-4o and is quota-flaky (HTTP 429). Cheap model
  // is fine here: this agent advises + reads, the heavier action agent stays on gpt-4o.
  CHAT_AGENT_MODEL: z.string().default("openai/gpt-4o-mini"),
  // Rebalancer strategy decider — also off the Hermes gateway (429-prone). Keeps the
  // stronger gpt-4o here (allocation reasoning), not the cheaper chat mini.
  REBALANCER_AGENT_MODEL: z.string().default("openai/gpt-4o"),
  LLM_MODEL: z.string().default("anthropic/claude-sonnet-4.6"),

  // ── Privy / pricing / mcp ─────────────────────────────────────────────────
  PRIVY_APP_ID: z.string().default(""),
  PRIVY_APP_SECRET: z.string().default(""),
  // Privy app verification public key (SPKI PEM, ES256) from the dashboard.
  PRIVY_VERIFICATION_KEY: z.string().default(""),
  PRIVY_JWT_ISSUER: z.string().default("privy.io"),
  COINGECKO_API_KEY: z.string().default(""),
  MCP_PORT: z.coerce.number().int().positive().default(8765),

  // Per-token APY estimate override (JSON, e.g. {"sUSDe":12,"mETH":3.5}). Merges
  // over the built-in defaults. These are ESTIMATES until a real protocol-APY
  // oracle is wired (Ondo/Mantle-LSP/Ethena).
  APY_PCT_JSON: z.string().default(""),

  // Rate limit per client IP for /api/* (fixed window).
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
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
