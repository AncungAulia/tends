# Deploy to Fly.io

Two apps + one Postgres:

| Fly app        | What                          | Exposure                          |
| -------------- | ----------------------------- | --------------------------------- |
| `tends-api`    | backend (API + indexer + jobs + WS) | public HTTPS                |
| `tends-hermes` | Hermes gateway + MCP tools    | private only (`*.internal:8642`)  |
| Fly Postgres   | database                      | private, attached to `tends-api`  |

> App names are **global** on Fly — if `tends-api` / `tends-hermes` are taken, rename
> in `fly.toml` / `fly.hermes.toml` (and the `tends-hermes.internal` reference below).

All commands run from `backend/`. Secrets come from the backup at
`/home/ulinuha/tends-backup-20260527/` (env.prod, hermes-auth.json, tends-db.sql.gz).

---

## 0. One-time

```bash
fly auth login
```

## 1. Postgres

```bash
fly postgres create --name tends-db --region sin --vm-size shared-cpu-1x --volume-size 1
# Restore the backed-up data (chat history + apy snapshots; rest re-syncs from chain):
fly postgres connect -a tends-db < <(gunzip -c /home/ulinuha/tends-backup-20260527/tends-db.sql.gz)
```

## 2. Backend app (`tends-api`)

```bash
# create the app WITHOUT deploying yet (so we can set secrets first)
fly apps create tends-api

# attach Postgres → sets DATABASE_URL secret on tends-api automatically
fly postgres attach tends-db -a tends-api

# import every secret from the backup EXCEPT the ones Fly/[env] handle:
#   NODE_ENV, PORT       → set in fly.toml [env]
#   DATABASE_URL         → set by `postgres attach`
#   HERMES_BASE_URL      → Fly-internal, set below
grep -vE '^(NODE_ENV|PORT|DATABASE_URL|HERMES_BASE_URL)=' \
  /home/ulinuha/tends-backup-20260527/env.prod | fly secrets import -a tends-api

# point the backend at the internal Hermes app
fly secrets set -a tends-api HERMES_BASE_URL=http://tends-hermes.internal:8642/v1

# deploy (runs `prisma migrate deploy` as release_command, then starts the machine)
fly deploy -a tends-api
```

Verify:

```bash
fly status -a tends-api
curl https://tends-api.fly.dev/health        # → {"status":"ok","db":"up",...}
curl https://tends-api.fly.dev/api/strategies # public route sanity
```

## 3. Hermes app (`tends-hermes`) — GitHub Copilot, needed for grounded chat

Provider stays **GitHub Copilot** (`hermes/config.yaml` already set). The OAuth
credential lives in the `hermes_home` volume (mount already in `fly.hermes.toml`).
Because we backed up the working `hermes-auth.json`, we restore it instead of
re-doing the device OAuth.

```bash
fly apps create tends-hermes
fly volumes create hermes_home --size 1 -a tends-hermes -r sin

# DATABASE_URL + contract addrs etc. (MCP server reads the DB). Use the SAME
# DATABASE_URL that `postgres attach` set on tends-api (copy from `fly secrets list`
# / your notes — secrets are write-only, so paste the connection string explicitly).
grep -vE '^(NODE_ENV|PORT|HERMES_BASE_URL|COPILOT_GITHUB_TOKEN)=' \
  /home/ulinuha/tends-backup-20260527/env.prod | fly secrets import -a tends-hermes
fly secrets set -a tends-hermes \
  DATABASE_URL="postgres://...tends-db.flycast:5432/tends_api?sslmode=disable" \
  COPILOT_GITHUB_TOKEN=""    # empty so it doesn't override the OAuth cred

fly deploy -c fly.hermes.toml -a tends-hermes

# restore the backed-up Copilot OAuth credential into the volume (no re-OAuth):
fly ssh console -a tends-hermes -C "mkdir -p /root/.hermes"
cat /home/ulinuha/tends-backup-20260527/hermes-auth.json | \
  fly ssh console -a tends-hermes -C "sh -c 'cat > /root/.hermes/auth.json'"
fly apps restart tends-hermes
```

If the restored credential ever expires, re-OAuth interactively instead:
`fly ssh console -a tends-hermes -C "hermes model --no-browser"` (follow the device
code), then `fly apps restart tends-hermes`.

Verify chat end-to-end (needs a valid Privy token):
```bash
curl -N -H "Authorization: Bearer <privy-token>" -H "content-type: application/json" \
  -d '{"message":"what is in my vault?"}' https://tends-api.fly.dev/api/chat
# → SSE stream grounded with real on-chain holdings (sUSDe/WMNT/cmETH/mETH)
```

---

## Notes / gotchas

- **Single instance only.** The indexer + schedulers + WS hub are stateful; never
  scale `tends-api` past 1 machine (`min/max = 1`, `auto_stop_machines = false`).
- **Frontend base URL** → `https://tends-api.fly.dev` (or a custom domain via
  `fly certs add`). WebSocket → `wss://tends-api.fly.dev/ws/dashboard`. No Cloudflare
  tunnel needed.
- **Region** is `sin` (Singapore) in both toml files — change `primary_region` if you
  prefer elsewhere.
- **Redeploy after code changes:** `fly deploy -a tends-api` (and
  `fly deploy -c fly.hermes.toml -a tends-hermes` for the agent). Migrations run
  automatically via `release_command`.
- **Memory:** 512mb each; bump `[[vm]] memory` to `1gb` if you see OOM in `fly logs`.
