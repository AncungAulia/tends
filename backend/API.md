# Tends Backend — API Contract (for Frontend)

Base URL: `http://localhost:3001` (dev) · set `NEXT_PUBLIC_API_URL` accordingly.
All bodies are JSON. CORS is open.

## Auth

Auth-gated endpoints need a **Privy access token** as a bearer header:

```
Authorization: Bearer <privy access token>
```

On 401 the body is `{ "error": "missing bearer token" | "invalid token" }`.
The token's `sub` (Privy DID) is the user identity; pair it with a wallet via
`POST /api/auth/verify` once after login.

## Shapes

```ts
type Tx = { to: `0x${string}`; data: `0x${string}`; value: string }; // sign via Privy
type Strategy = {
  id: "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";
  riskLevel: 0 | 1 | 2 | 3; name: string; tag: string;
  apyLabel: string; allocation: string; risk: string;
  blendedApyPct: number | null; // null for CUSTOM
};
type Projection = { capital: number; durationDays: number; blendedApyPct: number;
                    base: number; best: number; worst: number };
```

## Endpoints

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| GET | `/health` | – | – | `{ status, db, chainId, mockContracts, ts }` |
| POST | `/api/auth/verify` | ✅ | `{ walletAddress }` | `{ privyId, walletAddress }` |
| GET | `/api/strategies` | – | – | `{ strategies: Strategy[] }` |
| GET | `/api/strategies/:id` | – | – | `Strategy` · 404 if unknown |
| POST | `/api/projection` | – | `{ strategyId, capital, durationDays, customAllocation? }` | `Projection` |
| GET | `/api/apy/history` | – | `?asset=mETH&days=30` | `{ asset, days, history[] }` |
| GET | `/api/users/me/position` | ✅ | – | `{ vault }` |
| GET | `/api/users/me/activity` | ✅ | – | `{ activities[] }` |
| POST | `/api/users/me/deploy-vault` | ✅ | – | `{ tx: Tx }` |
| POST | `/api/users/me/prepare-deposit` | ✅ | `{ vault, account, amount }` | `{ steps: [approveTx, depositTx] }` |
| POST | `/api/users/me/prepare-deposit-permit` | ✅ | `{ vault, account, amount, deadline, signature }` | `{ tx }` (1-tx, see FE guide §4b) |
| POST | `/api/users/me/prepare-withdraw` | ✅ | `{ vault, account, amount }` | `{ tx: Tx }` |
| POST | `/api/users/me/prepare-switch` | ✅ | `{ vault, strategyId, customAllocation? }` | `{ steps: Tx[] }` |
| POST | `/api/chat` | ✅ | `{ message }` | SSE stream |
| WS | `/ws/dashboard` | – | – | JSON event stream |

Notes:
- `amount` is a plain USDC number (e.g. `100.5`); the backend scales to 6 decimals.
- `customAllocation` = `{ lowBps, medBps, highBps }`, must sum to `10000`. Required when `strategyId="CUSTOM"`.
- **deposit** is two txs — sign `steps[0]` (USDC approve) then `steps[1]` (vault deposit). **switch** to CUSTOM is two txs (set allocation, then set risk).
- First-time users: `deploy-vault` → then deposit. Get the user's `vault` address from `/users/me/position`.
- Invalid bodies return `400 { error, details? }`.

## Chat SSE

`POST /api/chat` returns `text/event-stream`:

```
event: text\ndata: <token chunk>     (repeated)
event: done\ndata:
event: error\ndata: <message>        (on failure)
```

Concatenate `text` chunks for the assistant reply.

## WebSocket `/ws/dashboard`

Connect (`ws://` / `wss://`, no auth) and receive live JSON events as the indexer
sees on-chain activity. Use it to refresh position/activity instead of polling.

```jsonc
{ "type": "connected" }                          // on connect
{ "type": "vault_deployed", "user": "0x…", "vault": "0x…" }
{ "type": "rebalanced", "vault": "0x…", "swaps": 3 }
{ "type": "activity", "vault": "0x…", "action": "REBALANCE" }
```

Events are broadcast to all clients (data is public on-chain) — filter by your
`vault` address client-side. Re-fetch `/api/users/me/{position,activity}` on a
matching event. Requires the backend's indexer to be running (`INDEXER_ENABLED`).

## Typical flow

1. User logs in with Privy (frontend) → get access token.
2. `POST /api/auth/verify { walletAddress }` (once).
3. `GET /api/users/me/position` → if `vault === null`, `POST /deploy-vault` and sign.
4. `POST /prepare-deposit` → sign both steps → funds in vault.
5. `POST /prepare-switch` to change strategy; agent rebalances on its schedule.
6. `GET /users/me/activity` (or poll) for agent actions; `POST /api/chat` for the assistant.
