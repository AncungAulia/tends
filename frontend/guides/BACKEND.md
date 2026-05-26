# Tends Frontend — Backend API Guide

> Panduan integrasi backend API ke frontend.
> Read alongside `INTEGRATION.md` (for SC calls) and `ARCHITECTURE.md`.
> Source of truth for backend: `backend/API.md`.

---

## Overview

Backend berjalan di `http://localhost:3001` (dev). Set via env var:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Prinsip utama:** Backend hanya dipakai untuk fitur enhancement. Semua operasi on-chain (deploy vault, deposit, withdraw, strategy) tetap langsung ke smart contract via wagmi — bukan via backend.

---

## Mana yang Pakai Backend vs Smart Contract

| Fitur | Sumber |
|---|---|
| Deploy vault | SC langsung — `deployVault()` |
| Deposit USDC | SC langsung — `depositWithPermit()` |
| Withdraw USDC | SC langsung — `withdraw()` / `redeemAll()` |
| Set strategy | SC langsung — `setRiskLevel()` / `setCustomAllocation()` |
| Vault address | SC langsung — `vaultOf(address)` |
| Holdings & balance | SC langsung — `useVaultHoldings` |
| **Activity log** | **Backend** — `GET /api/users/me/activity` |
| **Strategy APY** | **Backend** — `GET /api/strategies` |
| **Projection** | **Backend** — `POST /api/projection` |
| **APY history** | **Backend** — `GET /api/apy/history` |
| **Chat (Hermes)** | **Backend** — `POST /api/chat` (SSE) |
| **Real-time updates** | **Backend** — `ws://.../ws/dashboard` |

---

## Auth

Auth-gated endpoints butuh Privy access token sebagai bearer header:

```ts
Authorization: Bearer <privy_access_token>
```

Cara ambil token dari Privy:

```ts
import { usePrivy } from "@privy-io/react-auth";

const { getAccessToken } = usePrivy();
const token = await getAccessToken();
```

### Auto-verify setelah connect

Setelah wallet connect, fire `POST /api/auth/verify` di background — ini link Privy DID dengan wallet address di database backend. Satu kali per session, tidak block UI.

```ts
// src/hooks/useAuthVerify.ts
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect } from "react";

export function useAuthVerify() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!authenticated || !wallets[0]?.address) return;

    const verify = async () => {
      try {
        const token = await getAccessToken();
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ walletAddress: wallets[0].address }),
        });
      } catch {
        // silent — non-blocking
      }
    };

    verify();
  }, [authenticated, wallets[0]?.address]);
}
```

Panggil `useAuthVerify()` di `Dashboard.tsx` atau di layout — cukup sekali.

---

## API Client Helper

Buat helper di `src/lib/api.ts` untuk authenticated fetch:

```ts
// src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}
```

---

## Endpoints yang Dipakai Frontend

### Activity Log

```ts
// GET /api/users/me/activity  (auth required)
// Dipakai di: /activity page + dashboard activity preview

const activities = await apiFetch("/api/users/me/activity", token);
// → { activities: [{ id, vault, agent, action, metadata, timestamp, blockNumber }] }
```

### Strategy APY

```ts
// GET /api/strategies  (no auth)
// Dipakai di: Strategy slide-over (APY label per strategy)

const { strategies } = await apiFetch("/api/strategies", null);
// → Strategy[]  — ambil hanya apyLabel dan blendedApyPct, sisanya hardcode
```

### Projection

```ts
// POST /api/projection  (no auth)
// Dipakai di: Analytics page — scenario planner

const projection = await apiFetch("/api/projection", null, {
  method: "POST",
  body: JSON.stringify({
    strategyId: "LOW",        // "LOW" | "MEDIUM" | "HIGH" | "CUSTOM"
    capital: 10000,           // plain number, bukan bigint
    durationDays: 180,
    customAllocation: undefined, // { lowBps, medBps, highBps } hanya kalau CUSTOM
  }),
});
// → { capital, durationDays, blendedApyPct, base, best, worst }
```

### APY History

```ts
// GET /api/apy/history?asset=mETH&days=30  (no auth)
// Dipakai di: Analytics page — APY history chart

const history = await apiFetch("/api/apy/history?asset=mETH&days=30", null);
// → { asset, days, history: [{ date, apyPct }] }
```

---

## Chat — SSE Stream

`POST /api/chat` returns `text/event-stream`. Concatenate `text` chunks untuk reply lengkap.

```ts
// src/hooks/useChat.ts
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export function useChat() {
  const { getAccessToken } = usePrivy();
  const [messages, setMessages] = useState<{ role: "user" | "hermes"; text: string }[]>([]);
  const [streaming, setStreaming] = useState(false);

  const sendMessage = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setStreaming(true);

    const token = await getAccessToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let reply = "";

    // Add empty hermes message to stream into
    setMessages((prev) => [...prev, { role: "hermes", text: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("event: done")) {
          setStreaming(false);
          return;
        }
        if (line.startsWith("event: error")) {
          setStreaming(false);
          return;
        }
        if (line.startsWith("data: ")) {
          reply += line.slice(6);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "hermes", text: reply },
          ]);
        }
      }
    }

    setStreaming(false);
  };

  return { messages, sendMessage, streaming };
}
```

---

## WebSocket — Real-time Updates

Connect ke `ws://localhost:3001/ws/dashboard`. Filter events by vault address. On matching event → refetch data.

```ts
// src/hooks/useWebSocket.ts
import { useEffect, useState } from "react";

type WSStatus = "connected" | "connecting" | "disconnected";

export function useDashboardWS(
  vaultAddress: string | undefined,
  onRebalance: () => void,
  onActivity: () => void,
) {
  const [status, setStatus] = useState<WSStatus>("connecting");

  useEffect(() => {
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws")}/ws/dashboard`
    );

    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("disconnected");

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (!vaultAddress) return;
      if (event.vault?.toLowerCase() !== vaultAddress.toLowerCase()) return;

      if (event.type === "rebalanced") onRebalance();
      if (event.type === "activity") onActivity();
    };

    return () => ws.close();
  }, [vaultAddress]);

  return { status };
}
```

WebSocket status (`connected` / `connecting` / `disconnected`) ditampilkan sebagai indicator dot di sidebar:
- Hijau → connected
- Kuning → connecting / reconnecting
- Abu-abu → disconnected

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_API_URL=http://localhost:3001
```
