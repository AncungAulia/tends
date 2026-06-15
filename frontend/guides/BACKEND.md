# Tends Frontend — Backend Integration Guide

> How the frontend integrates with the Tends backend.
> Read alongside `INTEGRATION.md` (SC reads) and `ARCHITECTURE.md`.
> Source of truth for API shapes: `backend/API.md`.
> Source of truth for the signing pattern: `backend/FRONTEND_INTEGRATION.md`.

---

## The Rule — Read This First

**The frontend never encodes contract calls or talks to the chain for write actions directly.**

For every state-changing user action:
1. FE calls the backend REST endpoint
2. Backend returns an unsigned `Tx` or `steps: Tx[]`
3. FE verifies each `tx.to` against a known-contracts whitelist
4. FE signs each tx sequentially using the Privy embedded wallet
5. WebSocket events or refetch updates the UI

Direct viem reads (balance, price, holdings) remain direct SC calls — they are fast,
real-time, and require no backend trust.

| Action | How | Not |
|---|---|---|
| Deploy vault | `POST /api/users/me/deploy-vault` → sign `tx` | ❌ `VaultFactory.deployVault()` direct |
| Deposit USDC | `POST /api/users/me/prepare-deposit` → sign `steps[0,1]` | ❌ `USDC.approve` + `UserVault.deposit` direct |
| Withdraw USDC | `POST /api/users/me/prepare-withdraw` → sign `tx` | ❌ `UserVault.withdraw` direct |
| Switch strategy | `POST /api/users/me/prepare-switch` → sign `steps` | ❌ `setRiskLevel` / `setCustomAllocation` direct |
| Get vault address | `GET /api/users/me/position` | SC `vaultOf` secondary only |
| Portfolio data | — | ✅ `usePortfolio.ts` SC reads |
| Holdings/prices | — | ✅ `useVaultHoldings.ts`, `usePrices.ts` SC reads |
| Activity feed | `GET /api/users/me/activity` | — |
| Strategies + APY | `GET /api/strategies` | — |
| APY history chart | `GET /api/apy/history` | — |
| Projection | `POST /api/projection` | — |
| Chat | `POST /api/chat` (SSE) | — |
| Live updates | `WS /ws/dashboard` | — |

---

## Environment Setup

```env
# frontend/.env.local
NEXT_PUBLIC_API_URL=https://<backend-host>   # http://localhost:3001 in dev
NEXT_PUBLIC_PRIVY_APP_ID=<privy-app-id>      # MUST match backend PRIVY_APP_ID
NEXT_PUBLIC_CHAIN_ID=5003
```

`NEXT_PUBLIC_PRIVY_APP_ID` must be the same Privy app as the backend's `PRIVY_APP_ID`.
The backend verifies the access token's `aud` claim. Mismatch → 401 on every auth call.

---

## Privy Config — Required Addition

Add `noPromptOnSignature: true` to the embedded wallets config. This prevents Privy
from showing a separate confirmation popup for every tx sign — required for smooth
multi-step flows (deposit = 2 wallet prompts back-to-back).

```tsx
// app/providers.tsx
embeddedWallets: {
  createOnLogin: "users-without-wallets",
  noPromptOnSignature: true,   // ← required for multi-tx flows
},
```

---

## `src/lib/api.ts` — Authenticated Fetch Helper

```ts
// src/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL!

/**
 * Authenticated fetch to the Tends backend.
 * Pass the Privy access token as `token`, or null for public endpoints.
 */
export async function apiFetch<T>(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 401) throw new Error("Unauthorized — please reconnect your wallet.")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`)
  }

  return res.json() as Promise<T>
}
```

Usage:

```ts
import { usePrivy } from "@privy-io/react-auth"
import { apiFetch } from "@/lib/api"

const { getAccessToken } = usePrivy()
const token = await getAccessToken()

// Authenticated
const data = await apiFetch("/api/users/me/position", token)

// Public (no auth required)
const { strategies } = await apiFetch("/api/strategies", null)
```

---

## `src/hooks/useAuthVerify.ts` — Link Privy DID to Wallet

Fire-and-forget after login. Links the Privy DID to the wallet address in the backend
database. Run once per session — does not block the UI.

```ts
// src/hooks/useAuthVerify.ts
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useEffect } from "react"
import { apiFetch } from "@/lib/api"

export function useAuthVerify() {
  const { authenticated, getAccessToken } = usePrivy()
  const { wallets } = useWallets()

  useEffect(() => {
    if (!authenticated || !wallets[0]?.address) return

    const verify = async () => {
      try {
        const token = await getAccessToken()
        await apiFetch("/api/auth/verify", token, {
          method: "POST",
          body: JSON.stringify({ walletAddress: wallets[0].address }),
        })
      } catch {
        // Silent — non-blocking. Auth verify failure does not break the app.
      }
    }

    verify()
  }, [authenticated, wallets[0]?.address])
}
```

Call `useAuthVerify()` once in `Dashboard.tsx` or the root layout.

---

## `src/hooks/useBackendTx.ts` — Core Signing Hook

The single source of truth for all backend-prepared tx signing. All write hooks
(`useDeposit`, `useWithdraw`, `useRiskLevel`, `useUserVault`) delegate to this.

```ts
// src/hooks/useBackendTx.ts
import { useState } from "react"
import { useWallets } from "@privy-io/react-auth"
import { usePrivy } from "@privy-io/react-auth"
import { createWalletClient, custom } from "viem"
import { mantleSepolia } from "@/lib/chains"
import { apiFetch } from "@/lib/api"
import { ADDRESSES } from "@/lib/addresses"

type Tx = { to: `0x${string}`; data: `0x${string}`; value: string }

export type BackendTxState = "idle" | "pending" | "confirming" | "success" | "error"

// Addresses the backend is allowed to send unsigned txs to.
// The user's vault address is added dynamically per-call.
const BASE_ALLOWED_TARGETS = new Set([
  ADDRESSES.VAULT_FACTORY.toLowerCase(),
  "0x29faf6cafa4bea1dc7c232f0a1818d4da6b724dd", // USDC
])

/** Safety check: throw if tx.to is not in the known-contract whitelist. */
function verifyTx(tx: Tx, vaultAddress?: string): void {
  const allowed = new Set(BASE_ALLOWED_TARGETS)
  if (vaultAddress) allowed.add(vaultAddress.toLowerCase())
  if (!allowed.has(tx.to.toLowerCase())) {
    throw new Error(`Unexpected tx target: ${tx.to} — refusing to sign`)
  }
}

export function useBackendTx() {
  const { wallets } = useWallets()
  const { getAccessToken } = usePrivy()
  const [state, setState] = useState<BackendTxState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [hashes, setHashes] = useState<`0x${string}`[]>([])

  const signTx = async (tx: Tx): Promise<`0x${string}`> => {
    const wallet = wallets[0]
    if (!wallet) throw new Error("No wallet connected")
    const provider = await wallet.getEthereumProvider()
    const client = createWalletClient({
      account: wallet.address as `0x${string}`,
      chain: mantleSepolia,
      transport: custom(provider),
    })
    return client.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value),
    })
  }

  /**
   * Call a backend endpoint, verify returned tx targets, sign each tx in order.
   * @param path         - e.g. "/api/users/me/prepare-deposit"
   * @param body         - JSON body for the POST
   * @param vaultAddress - user's vault address (added to whitelist for this call)
   */
  const execute = async <TResp extends { tx?: Tx; steps?: Tx[] }>(
    path: string,
    body: object,
    vaultAddress?: string
  ): Promise<`0x${string}`[]> => {
    setState("pending")
    setError(null)
    setHashes([])

    try {
      const token = await getAccessToken()
      const data = await apiFetch<TResp>(path, token, {
        method: "POST",
        body: JSON.stringify(body),
      })

      const txs: Tx[] = data.steps ?? (data.tx ? [data.tx] : [])

      // Verify ALL tx targets before signing anything
      for (const tx of txs) verifyTx(tx, vaultAddress)

      setState("confirming")

      const results: `0x${string}`[] = []
      for (const tx of txs) {
        const hash = await signTx(tx)
        results.push(hash)
      }

      setHashes(results)
      setState("success")
      return results
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed"
      setError(msg)
      setState("error")
      throw err
    }
  }

  const reset = () => {
    setState("idle")
    setError(null)
    setHashes([])
  }

  return {
    execute,
    state,
    error,
    hashes,
    reset,
    isPending: state === "pending",
    isConfirming: state === "confirming",
  }
}
```

---

## `src/hooks/useUserVault.ts` — Vault Address + Deploy

Reads vault address from backend `/position`. Deploy goes through `useBackendTx`.

```ts
// src/hooks/useUserVault.ts
import { usePrivy } from "@privy-io/react-auth"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { useBackendTx } from "@/hooks/useBackendTx"
import { useVaultStore } from "@/hooks/useVaultStore"

interface Position {
  vault: null | { address: string; riskPreference: number }
}

export function useUserVault() {
  const { getAccessToken, authenticated } = usePrivy()
  const { setVaultAddress } = useVaultStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["position"],
    queryFn: async () => {
      const token = await getAccessToken()
      const result = await apiFetch<Position>("/api/users/me/position", token)
      if (result.vault) setVaultAddress(result.vault.address)
      return result
    },
    enabled: authenticated,
  })

  const vaultAddress = data?.vault?.address as `0x${string}` | undefined
  const hasVault = !!vaultAddress

  const { execute, isPending, isConfirming, state, error } = useBackendTx()

  const deployVault = async () => {
    await execute("/api/users/me/deploy-vault", {})
    // Vault address arrives via WebSocket `vault_deployed` event.
    // Poll /position as fallback until it appears (backend indexer lag ~1-2 blocks).
    const poll = setInterval(async () => {
      const result = await refetch()
      if (result.data?.vault) clearInterval(poll)
    }, 3000)
    setTimeout(() => clearInterval(poll), 30_000)
  }

  return { vaultAddress, hasVault, deployVault, isPending, isConfirming, state, error, refetch }
}
```

---

## `src/hooks/useDeposit.ts` — Deposit via Backend

Backend returns `steps: [approveTx, depositTx]` — always 2 transactions.
`amount` is a plain USDC number (e.g. `100.5`) — backend scales to 6 decimals.

```ts
// src/hooks/useDeposit.ts
import { useBackendTx } from "@/hooks/useBackendTx"

export function useDeposit() {
  const { execute, state, isPending, isConfirming, error, reset } = useBackendTx()

  const deposit = (vaultAddress: string, userAddress: string, amount: number) =>
    execute(
      "/api/users/me/prepare-deposit",
      { vault: vaultAddress, account: userAddress, amount },
      vaultAddress
    )

  return { deposit, state, isPending, isConfirming, error, reset }
}
```

UI notes:
- `isPending` = wallet confirmation prompt shown (tx 1, approve)
- `isConfirming` = txs broadcasting on-chain
- Show a single spinner for both steps — user sees 2 wallet prompts back-to-back
- Only show "Done" after `state === "success"` (both txs confirmed)

---

## `src/hooks/useWithdraw.ts` — Withdraw via Backend

```ts
// src/hooks/useWithdraw.ts
import { useBackendTx } from "@/hooks/useBackendTx"

export function useWithdraw() {
  const { execute, state, isPending, isConfirming, error, reset } = useBackendTx()

  /**
   * Withdraw a USDC amount from the vault.
   * amount: plain USDC number — backend scales to 6 decimals.
   */
  const withdraw = (vaultAddress: string, userAddress: string, amount: number) =>
    execute(
      "/api/users/me/prepare-withdraw",
      { vault: vaultAddress, account: userAddress, amount },
      vaultAddress
    )

  return { withdraw, state, isPending, isConfirming, error, reset }
}
```

Withdrawal is always available — even when vault is `paused`. Never disable the
Withdraw button based on the vault paused state. Only deposits are blocked.

---

## `src/hooks/useRiskLevel.ts` — Strategy Switch

SC reads remain direct. Writes go through backend.

```ts
// src/hooks/useRiskLevel.ts
import { useReadContracts } from "wagmi"
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi"
import { useBackendTx } from "@/hooks/useBackendTx"

export type StrategyId = "LOW" | "MEDIUM" | "HIGH" | "CUSTOM"

export function useRiskLevel(vaultAddress: `0x${string}` | undefined) {
  // Reads: direct SC calls — fast and real-time
  const { data } = useReadContracts({
    contracts: [
      { address: vaultAddress!, abi: UserVaultAbi, functionName: "riskPreference" },
      { address: vaultAddress!, abi: UserVaultAbi, functionName: "customAllocation" },
    ],
    query: { enabled: !!vaultAddress },
  })

  const [riskPreference, customAlloc] = data ?? []

  const { execute, isPending, isConfirming, state, error } = useBackendTx()

  /** Switch to a preset strategy (LOW | MEDIUM | HIGH). 1 transaction. */
  const setStrategy = (strategyId: Exclude<StrategyId, "CUSTOM">) => {
    if (!vaultAddress) return
    return execute(
      "/api/users/me/prepare-switch",
      { vault: vaultAddress, strategyId },
      vaultAddress
    )
  }

  /**
   * Switch to custom allocation. bps values must sum to 10000.
   * 1 transaction — setCustomAllocation sets riskPreference=CUSTOM on-chain.
   * Calling setRiskLevel(CUSTOM) separately would revert.
   */
  const setCustomStrategy = (lowBps: number, medBps: number, highBps: number) => {
    if (!vaultAddress) return
    if (lowBps + medBps + highBps !== 10_000)
      throw new Error("Allocation must sum to 10000 bps (100%)")
    return execute(
      "/api/users/me/prepare-switch",
      { vault: vaultAddress, strategyId: "CUSTOM", customAllocation: { lowBps, medBps, highBps } },
      vaultAddress
    )
  }

  return {
    currentLevel: riskPreference?.result,
    customAlloc: customAlloc?.result,
    setStrategy,
    setCustomStrategy,
    isPending,
    isConfirming,
    state,
    error,
  }
}
```

---

## Chat — SSE Stream

`POST /api/chat` returns `text/event-stream`. Concatenate `text` event chunks.

```ts
// src/hooks/useChat.ts
import { usePrivy } from "@privy-io/react-auth"
import { useState } from "react"
import { apiFetch } from "@/lib/api"

type Message = { role: "user" | "hermes"; text: string }

export function useChat() {
  const { getAccessToken } = usePrivy()
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)

  const sendMessage = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", text: message }])
    setStreaming(true)

    const token = await getAccessToken()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    })

    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ""
    let reply = ""

    setMessages((prev) => [...prev, { role: "hermes", text: "" }])

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buf += dec.decode(value, { stream: true })
      const frames = buf.split("\n\n")
      buf = frames.pop() ?? ""

      for (const f of frames) {
        const ev = /event: (\w+)/.exec(f)?.[1]
        const data = /data: ?(.*)/.exec(f)?.[1] ?? ""
        if (ev === "text") {
          reply += data
          setMessages((prev) => [...prev.slice(0, -1), { role: "hermes", text: reply }])
        }
        if (ev === "done" || ev === "error") {
          setStreaming(false)
          return
        }
      }
    }

    setStreaming(false)
  }

  return { messages, sendMessage, streaming }
}
```

---

## WebSocket — Real-time Dashboard Updates

Connect to `/ws/dashboard`. Filter events by vault address. Refetch on matching events.

```ts
// src/hooks/useDashboardWS.ts
import { useEffect, useState } from "react"

type WSStatus = "connected" | "connecting" | "disconnected"

export function useDashboardWS(
  vaultAddress: string | undefined,
  onUpdate: () => void
) {
  const [status, setStatus] = useState<WSStatus>("connecting")

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL!.replace(/^http/, "ws") + "/ws/dashboard"
    let ws: WebSocket

    const connect = () => {
      ws = new WebSocket(url)
      setStatus("connecting")

      ws.onopen = () => setStatus("connected")
      ws.onclose = () => {
        setStatus("disconnected")
        setTimeout(connect, 2000) // auto-reconnect
      }
      ws.onerror = () => setStatus("disconnected")

      ws.onmessage = (e) => {
        const ev = JSON.parse(e.data) as { type: string; vault?: string }
        if (!vaultAddress) return
        if (ev.type === "connected") return
        if (ev.vault?.toLowerCase() === vaultAddress.toLowerCase()) onUpdate()
      }
    }

    connect()
    return () => ws?.close()
  }, [vaultAddress])

  return { status }
}
```

WebSocket status displayed as a dot in the sidebar:
- Green dot → `connected`
- Yellow dot → `connecting` / reconnecting
- Grey dot → `disconnected`

---

## Error Handling — Backend Errors

Backend returns `{ error: string, details?: unknown }` on 4xx. `apiFetch` throws
`Error` with the message. Surface with sonner:

```ts
import { toast } from "sonner"

try {
  await deposit(vault, address, amount)
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Deposit failed")
}
```

SC errors (from read hooks or event watchers) still use `parseTendsError()` from
`src/lib/errors.ts`.

---

## API Reference

| Method | Path | Auth | Body / Query | Response |
|---|---|---|---|---|
| POST | `/api/auth/verify` | ✅ | `{ walletAddress }` | `{ privyId, walletAddress }` |
| GET | `/api/strategies` | — | — | `{ strategies: Strategy[] }` |
| GET | `/api/strategies/:id` | — | — | `Strategy` · 404 if unknown |
| POST | `/api/projection` | — | `{ strategyId, capital, durationDays, customAllocation? }` | `{ base, best, worst, blendedApyPct }` |
| GET | `/api/apy/history` | — | `?asset=mETH&days=30` | `{ asset, days, history[] }` |
| GET | `/api/users/me/position` | ✅ | — | `{ vault: null \| { address, riskPreference } }` |
| GET | `/api/users/me/activity` | ✅ | — | `{ activities[] }` |
| POST | `/api/users/me/deploy-vault` | ✅ | — | `{ tx: Tx }` |
| POST | `/api/users/me/prepare-deposit` | ✅ | `{ vault, account, amount }` | `{ steps: [approveTx, depositTx] }` |
| POST | `/api/users/me/prepare-withdraw` | ✅ | `{ vault, account, amount }` | `{ tx: Tx }` |
| POST | `/api/users/me/prepare-switch` | ✅ | `{ vault, strategyId, customAllocation? }` | `{ steps: Tx[] }` |
| POST | `/api/chat` | ✅ | `{ message }` | SSE stream |
| WS | `/ws/dashboard` | — | — | JSON event stream |

`amount` = plain USDC number (e.g. `100.5`) — backend scales to 6 decimals internally.
`customAllocation` = `{ lowBps, medBps, highBps }` — must sum to `10000`.

---

## Pre-build Checklist

- [ ] `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_PRIVY_APP_ID` set in `.env.local`
- [ ] `NEXT_PUBLIC_PRIVY_APP_ID` matches backend `PRIVY_APP_ID`
- [ ] `noPromptOnSignature: true` in Privy embedded wallets config
- [ ] All write hooks (`useDeposit`, `useWithdraw`, `useRiskLevel`, `useUserVault`) delegate to `useBackendTx`
- [ ] No `useWriteContract` used for user-facing write actions
- [ ] Tx verification (`verifyTx`) active in `useBackendTx`
- [ ] Backend errors surfaced via toast — not swallowed silently
- [ ] After vault deploy, poll `/position` or wait for WebSocket `vault_deployed` event
- [ ] Deposit: only show "Done" after `state === "success"` (both txs confirmed)
