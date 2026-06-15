# Frontend Integration Guide — Tends Backend

How the Next.js frontend integrates with this backend. The endpoint **reference**
(shapes, status codes) is in [`API.md`](./API.md); this is the **how-to** with code.

Stack assumed: Next.js + Privy (embedded wallet) + viem, Mantle Sepolia (chainId **5003**).

---

## 0. Which doc? (SC INTEGRATION.md vs this) — READ FIRST

There are two integration docs; they don't actually conflict — they're for **different
consumers**:

- `smart-contract/INTEGRATION.md` (Axel's) = **backend ↔ contracts**. It's for the
  **backend** (the agent/relayer signing with the agent key). **The frontend does NOT
  use it.**
- `API.md` + this file = **frontend ↔ backend**. **This is yours.**

**Rule of thumb:** the FE never encodes contract calls or talks to the chain for
**write** actions. For every user action the FE calls the backend, gets back an
**unsigned tx**, and signs it with Privy. The backend owns the contract details
(addresses, ABIs, decimals, approve+deposit ordering, gas top-up).

| Action | Use | Don't |
|---|---|---|
| **Deposit** | `POST /api/users/me/prepare-deposit` → sign `steps` | ❌ call `UserVault.deposit` directly |
| **Withdraw** | `POST /api/users/me/prepare-withdraw` → sign `tx` | ❌ call `UserVault.withdraw` directly |
| **Switch strategy** | `POST /api/users/me/prepare-switch` → sign `steps` | ❌ call `setRiskLevel`/`setCustomAllocation` directly |
| **Create vault** | `POST /api/users/me/deploy-vault` → sign `tx` | ❌ call `VaultFactory.deployVault` directly |
| Read position / activity / strategies / projection | backend `GET`/`POST` | — |
| Read raw chain (e.g. USDC balance/allowance for UI) | direct viem read is fine | — |

So **deposit = backend API (`/prepare-deposit`)**, not the SC function. Same for
withdraw/switch/deploy-vault. (Why: backend returns the correct 2-step approve+deposit,
scales decimals, and best-effort tops up gas — one stable surface that can evolve
without FE changes.)

---

## 1. Setup

```bash
# frontend .env.local
NEXT_PUBLIC_API_URL=https://<your-backend-host>      # http://localhost:3001 in dev
NEXT_PUBLIC_PRIVY_APP_ID=<same app id as backend PRIVY_APP_ID>   # MUST match
NEXT_PUBLIC_CHAIN_ID=5003
```

> ⚠️ The frontend's `NEXT_PUBLIC_PRIVY_APP_ID` **must be the same Privy app** as the
> backend's `PRIVY_APP_ID` — the backend verifies the access token's `aud` against it.
> Mismatch → every auth'd call returns `401`.

Privy provider (chain config):

```tsx
import { mantleSepoliaTestnet } from "viem/chains";
<PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{ defaultChain: mantleSepoliaTestnet, supportedChains: [mantleSepoliaTestnet],
            embeddedWallets: { createOnLogin: "users-without-wallets", noPromptOnSignature: true } }}>
```

---

## 2. Authenticated fetch

Every auth'd endpoint needs the Privy access token as `Authorization: Bearer …`.

```ts
import { usePrivy } from "@privy-io/react-auth";

const API = process.env.NEXT_PUBLIC_API_URL!;

export function useApi() {
  const { getAccessToken } = usePrivy();
  return async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401) throw new Error("unauthorized — re-login");
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
    return res.json() as Promise<T>;
  };
}
```

Public endpoints (`/strategies`, `/projection`, `/apy/history`) work without a token.

---

## 3. Signing prepared transactions

Action endpoints return unsigned `Tx = { to, data, value }`. Sign with the Privy
embedded wallet. Example with viem's wallet client from Privy:

```ts
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";

async function signTx(wallet, tx: { to: `0x${string}`; data: `0x${string}`; value: string }) {
  const provider = await wallet.getEthereumProvider();
  const client = createWalletClient({ account: wallet.address as `0x${string}`,
    chain: mantleSepoliaTestnet, transport: custom(provider) });
  return client.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
}

// Multi-step (deposit / custom switch): sign in order, awaiting each.
async function signSteps(wallet, steps: Tx[]) {
  const hashes: `0x${string}`[] = [];
  for (const step of steps) hashes.push(await signTx(wallet, step));
  return hashes;
}
```

> Users need a little **MNT for gas** on Mantle Sepolia (faucet:
> https://faucet.sepolia.mantle.xyz). Backend gas-sponsorship isn't wired yet.

---

## 4. User journey (with calls)

```ts
const api = useApi();
const wallet = useWallets().wallets[0];

// (a) once after login — link the verified session to a wallet
await api("/api/auth/verify", { method: "POST",
  body: JSON.stringify({ walletAddress: wallet.address }) });

// (b) do they have a vault yet?
const { vault } = await api<{ vault: null | { address: string; riskPreference: number } }>(
  "/api/users/me/position");

// (c) first-timer → deploy their vault
if (!vault) {
  const { tx } = await api<{ tx: Tx }>("/api/users/me/deploy-vault", { method: "POST" });
  await signTx(wallet, tx);
  // re-fetch /position to get the new vault address (after the tx confirms / indexer picks it up)
}

// (d) deposit 100 USDC  → two txs: approve then deposit
const dep = await api<{ steps: Tx[] }>("/api/users/me/prepare-deposit", { method: "POST",
  body: JSON.stringify({ vault: vault!.address, account: wallet.address, amount: 100 }) });
await signSteps(wallet, dep.steps);

// (e) switch strategy (preset)
const sw = await api<{ steps: Tx[] }>("/api/users/me/prepare-switch", { method: "POST",
  body: JSON.stringify({ vault: vault!.address, strategyId: "HIGH" }) });
await signSteps(wallet, sw.steps);

//     custom mix (bps must sum to 10000)
await api("/api/users/me/prepare-switch", { method: "POST", body: JSON.stringify({
  vault: vault!.address, strategyId: "CUSTOM",
  customAllocation: { lowBps: 5000, medBps: 3000, highBps: 2000 } }) });

// (f) withdraw 25 USDC
const wd = await api<{ tx: Tx }>("/api/users/me/prepare-withdraw", { method: "POST",
  body: JSON.stringify({ vault: vault!.address, account: wallet.address, amount: 25 }) });
await signTx(wallet, wd.tx);

// (g) agent activity (poll every ~15s, or render once)
const { activities } = await api<{ activities: unknown[] }>("/api/users/me/activity");
```

Public reads (no auth):

```ts
const { strategies } = await api("/api/strategies");                 // picker cards
await fetch(`${API}/api/projection`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ strategyId: "LOW", capital: 1000, durationDays: 365 }) }); // { base, best, worst }
await fetch(`${API}/api/apy/history?asset=mETH&days=30`);            // chart series
```

---

## 4b. Optional: 1-tx deposit via permit

Saves the separate approve tx. The user signs an EIP-2612 permit (gasless,
`signTypedData`), then submits a single `depositWithPermit`.

```ts
import { parseAbi } from "viem";
// 1. read the USDC nonce for the user (direct viem read is fine)
const nonce = await publicClient.readContract({
  address: USDC_ADDR, abi: parseAbi(["function nonces(address) view returns (uint256)"]),
  functionName: "nonces", args: [wallet.address],
});
const deadline = Math.floor(Date.now() / 1000) + 3600;

// 2. sign the permit (Privy signTypedData)
const signature = await wallet.signTypedData({
  domain: { name: "USD Coin", version: "1", chainId: 5003, verifyingContract: USDC_ADDR },
  types: { Permit: [
    { name: "owner", type: "address" }, { name: "spender", type: "address" },
    { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" } ] },
  primaryType: "Permit",
  message: { owner: wallet.address, spender: vault, value: parseUnits("100", 6), nonce, deadline: BigInt(deadline) },
});

// 3. backend encodes depositWithPermit; you sign + send the single tx
const { tx } = await api("/api/users/me/prepare-deposit-permit", { method: "POST",
  body: JSON.stringify({ vault, account: wallet.address, amount: 100, deadline, signature }) });
await signTx(wallet, tx);
```

`value` in the permit must equal the deposit amount scaled to 6-dec USDC. The plain
2-step `/prepare-deposit` remains fully supported — use whichever you prefer.

## 5. Chat (SSE)

`POST /api/chat` streams the assistant reply as Server-Sent Events.

```ts
async function chat(message: string, token: string, onChunk: (t: string) => void) {
  const res = await fetch(`${API}/api/chat`, { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }) });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split("\n\n"); buf = frames.pop() ?? "";
    for (const f of frames) {
      const ev = /event: (\w+)/.exec(f)?.[1];
      const data = /data: ?(.*)/.exec(f)?.[1] ?? "";
      if (ev === "text") onChunk(data);
      if (ev === "error") throw new Error(data);
    }
  }
}
```

---

## 6. Live updates (WebSocket)

Instead of polling, subscribe to `/ws/dashboard` and refetch on relevant events.

```ts
function watchDashboard(myVault: string, onUpdate: () => void) {
  const url = process.env.NEXT_PUBLIC_API_URL!.replace(/^http/, "ws") + "/ws/dashboard";
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    const ev = JSON.parse(e.data) as { type: string; vault?: string };
    // events: connected | vault_deployed | rebalanced | activity
    if (ev.vault?.toLowerCase() === myVault.toLowerCase()) onUpdate(); // refetch position/activity
  };
  ws.onclose = () => setTimeout(() => watchDashboard(myVault, onUpdate), 2000); // reconnect
  return () => ws.close();
}
```

No auth on the socket; data is public on-chain, so filter by your `vault` client-side.

## 7. Gotchas

- **Privy app id must match** backend ⇒ else 401 on every auth'd call.
- `amount` is a **plain USDC number** (`100.5`) — backend scales to 6 decimals.
- **deposit = 2 signatures** (approve, then deposit); **switch→CUSTOM = 2** (set allocation, then risk).
- `position.vault` is `null` until the user deploys one — guard the deposit/withdraw UI on it.
- Fresh data (position/activity) depends on the backend **indexer** running; until then it can lag a block or two. Re-fetch after a tx confirms.
- Validation errors return `400 { error, details? }`; surface `error` to the user.
- Strategy ids: `LOW | MEDIUM | HIGH | CUSTOM`. On-chain `riskPreference` is `0|1|2|3` in the same order.
