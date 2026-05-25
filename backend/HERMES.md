# Hermes Agent — Setup & Deploy

`/api/chat` relays to a **Hermes Agent gateway** (a separate Python service). Hermes
runs the LLM (via OpenRouter) and calls our tools over **MCP**.

```
Frontend ──/api/chat──▶ Backend (Node)
                           │ OpenAI-compatible HTTP (HERMES_BASE_URL, Bearer HERMES_API_KEY)
                           ▼
                     Hermes gateway (Python, :8642)
                        │ LLM = OpenRouter        │ MCP (stdio subprocess)
                        ▼                          ▼
                    model reply            node dist/mcp/server.js  ── 8 tools
                                                  │  (Prisma + services)
                                                  ▼
                                              Postgres + chain
```

The 8 MCP tools: `readUserPosition`, `getAgentActivity`, `listStrategies`,
`getApyHistory`, `computeProjection`, `prepareDepositTx`, `prepareWithdrawTx`,
`prepareSwitchTx` (see `src/mcp/tools.ts`). The MCP server logs to **stderr** so the
stdio JSON-RPC on stdout stays clean.

## Files

```
hermes/
├── Dockerfile        # Python + Node; builds our MCP server, installs hermes-agent
├── config.yaml       # model (OpenRouter) + system prompt + mcp_servers: tends
└── .env.example      # API_SERVER_*, OPENROUTER_API_KEY, DATABASE_URL + addresses
```

## Run locally

```bash
pip install hermes-agent
mkdir -p ~/.hermes && cp hermes/config.yaml ~/.hermes/config.yaml
# put hermes/.env.example values into ~/.hermes/.env (real OPENROUTER_API_KEY, DB, addrs)
pnpm build                       # so dist/mcp/server.js exists for Hermes to spawn
hermes gateway                   # OpenAI-compatible API on http://127.0.0.1:8642

# backend .env: point at it
#   HERMES_BASE_URL=http://127.0.0.1:8642/v1
#   HERMES_API_KEY=<same as API_SERVER_KEY>
```

Then `POST /api/chat { "message": "..." }` streams a real reply.

## Deploy (Railway — second service)

1. New service from the same repo, **root dir `backend/`**, builder Dockerfile,
   `dockerfilePath = hermes/Dockerfile`.
2. Set its Variables from `hermes/.env.example` (real `OPENROUTER_API_KEY`,
   `API_SERVER_KEY`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, contract addresses).
3. On the **backend** service set `HERMES_BASE_URL=http://<hermes-service>:8642/v1`
   and `HERMES_API_KEY=<same API_SERVER_KEY>` (use Railway's private networking).

So Option A = **2 services** (backend + hermes) sharing one Postgres.

## ⚠️ Caveats (couldn't be smoke-tested here)

- `pip install hermes-agent` and the gateway run were not verified in this repo —
  validate the image builds and `hermes gateway` starts; pin the version once it does.
- `config.yaml`'s **model/provider keys** follow the OpenAI-compatible pattern but may
  differ by Hermes version — check the [Hermes docs](https://hermes-agent.nousresearch.com/docs)
  and adjust. The `mcp_servers` block follows the documented MCP config.
- The MCP server itself **is** tested (`src/mcp/tools.test.ts`) and verified to keep
  stdout protocol-clean.

## Fallback

If standing up Hermes is blocked, `/api/chat`'s frontend contract is identical for a
direct-LLM implementation (swap `streamChat` in `src/agents/hermes-client.ts` to call
OpenRouter directly) — no frontend changes needed.
