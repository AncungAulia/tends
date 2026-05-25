# Tends — Backend

AI-managed RWA yield aggregator on Mantle. Backend = API gateway + Hermes Agent
integration + chain indexer + supporting services. See `docs/` on the `main`
branch (`01-ARCHITECTURE.md`, `02-SMART_CONTRACTS.md`, `03-BACKEND_FRONTEND.md`).

## Stack

- **Runtime:** Node 22+ / TypeScript (ESM), [Hono](https://hono.dev) HTTP server
- **DB:** Postgres via Prisma · **Cache:** Redis (ioredis)
- **Chain:** viem (reads) + ethers v6 (signing), Mantle Sepolia → Mainnet
- **Agent:** [Hermes Agent](https://hermes-agent.nousresearch.com) sidecar (see below)
- **Pricing:** CoinGecko · **Auth:** Privy JWT verification

## Architecture

```
Frontend ──/api/chat──▶ Backend (Hono)
                           │  OpenAI-compatible HTTP
                           ▼
                     Hermes Agent  (sidecar: `hermes gateway` :8642)
                           │  MCP (stdio)
                           ▼
                     Tends MCP server (src/mcp/server.ts) ── our tools
                           │
                           ▼
                     Postgres + Mantle RPC
```

> **Note on Hermes:** the docs reference `@nous/hermes-agent` (a TS SDK) — that
> package does not exist. Hermes Agent is a Python CLI agent runtime. We integrate
> via its **OpenAI-compatible API server** (`hermes gateway`) and expose our tools
> through an **MCP server**, rather than `new HermesAgent({ tools })`.

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in secrets as available
pnpm infra:up                 # Postgres + Redis via Docker
pnpm db:push                  # apply schema to the DB
pnpm dev                      # http://localhost:3001/health
```

Hermes sidecar (separate process, for the agent layer):

```bash
pip install hermes-agent
# ~/.hermes/.env:    API_SERVER_ENABLED=true, API_SERVER_KEY=...
# ~/.hermes/config.yaml: register the `tends` MCP server (see src/mcp/server.ts)
hermes gateway        # OpenAI-compatible API on :8642
```

## Layout

```
src/
├── index.ts            # Hono app + /health, route mounts
├── config/env.ts       # zod-validated env (fails fast)
├── lib/logger.ts       # pino
├── db/client.ts        # prisma singleton
├── chain/              # viem clients + agent wallet, abis, tokens/feeds, addresses
├── services/           # price-pusher · rebalancer · indexer · pricing · gas-funder · tx-executor
├── agents/             # hermes-client (gateway relay) + cron drivers
├── mcp/server.ts       # MCP server exposing tools to Hermes
└── api/                # route modules (auth, strategies, users, chat) — TBD
prisma/schema.prisma    # User, Vault (1:1, holds risk+shares), ChatMessage,
                        # ApyHistory, AgentActivity, GasTopUp, IndexerState
```

## Smart-contract integration

Architecture is **per-user vault** (1 user = 1 `UserVault` via `VaultFactory`) — see
`INTEGRATION.md` (from the smart-contract team), which supersedes `docs/02`.

### Price pipeline

The deployed `PriceFeed` is **pull-based** — `getPrice()` reads live from MockOracle.
It has **no `pushPrices()`** (INTEGRATION.md §1 is outdated). Prices flow:

```
RedStone pull feeds + Ondo USDY (mainnet)
  └─ relayer (services/relayer.ts, scheduler, signed by AGENT_EXECUTOR) → MockOracle.setPrices()
       └─ PriceFeed.getPrice() reads MockOracle live  ── consumed by rebalancer + price-monitor
```

The price relayer was **handed off into this backend** (`services/relayer.ts`, ported
from the `~/rwa-oracle` reference project). It fetches RedStone + Ondo USDY and pushes
43 feeds to MockOracle, driven by `scheduler.ts` (always-on when `RELAYER_ENABLED=true`,
every `RELAYER_INTERVAL_SEC`; manual run: `pnpm relayer:once`). `price-monitor.ts` is the
read-only freshness watcher. Feed IDs in `chain/tokens.ts` match the relayer's keys.

> **Deploy note:** set `RELAYER_ENABLED=true` on the server. Per `~/rwa-oracle/RELAYER-HANDOFF.md`,
> the oracle team's local cron stays on as backup until this backend relayer is confirmed live.

The backend's one on-chain write job, signed by the **AGENT_EXECUTOR** wallet
(address authorized in the contracts by the SC team):

- **Rebalance agent** (`services/rebalancer.ts`) — loop vaults, read risk pref, build `SwapInstruction[]` off-chain, call `vault.rebalance()`.

## Testing

`pnpm test` (Node's built-in runner via tsx) · `pnpm test:coverage`. 99 tests, ~93%
line/branch coverage. Pure logic (rebalance planning, projection, strategies, auth
verify, env, token math) is at 100%; the uncovered remainder is I/O glue (default
chain/DB/network deps) that's verified live via `pnpm verify:chain` / `relayer:once`
and boot smoke tests. Services use constructor-injected dependencies so orchestration
is tested with fakes.

## API

- `GET /api/strategies`, `GET /api/strategies/:id`
- `POST /api/projection` — `{ strategyId, capital, durationDays, customAllocation? }`
- `GET /api/users/me/position`, `GET /api/users/me/activity` — Privy-JWT auth (jose)

## Status

Live on Mantle Sepolia (`USE_MOCK_CONTRACTS=false`). Feature-complete for v1:
chain layer + agent wallet, rebalance planning, price relayer + monitor, scheduler
(relayer/rebalancer/price-monitor/apy-scraper, env-gated), full API (auth/verify,
strategies, projection, apy/history, chat SSE, users/me position/activity +
prepare-deposit/withdraw/switch + deploy-vault), Privy-JWT auth, indexer (event
watchers + mappers), `WS /ws/dashboard` (live broadcast), Hermes MCP tools + gateway
service, deploy artifacts (Dockerfile, railway.json, Prisma migration). 128 tests.

Docs: `API.md` (contract), `FRONTEND_INTEGRATION.md` (frontend how-to), `HERMES.md`
(agent setup). Needs real keys to fully run: `PRIVY_APP_ID` + `PRIVY_VERIFICATION_KEY`
(auth), `OPENROUTER_API_KEY` + Hermes service (chat).
