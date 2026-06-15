# Tends Frontend — Architecture Guide

> Read this before writing a single line of code.
> Read alongside `DESIGN.md`, `INTEGRATION.md`, and `BACKEND.md`.

---

## Overview

The Tends frontend is a Next.js App Router application. It is a financial tool — not a marketing site. The codebase is organized around a clear separation of concerns: routing lives in `app/`, feature UI lives in `src/modules/`, shared primitives in `src/components/`, contract interaction in `src/hooks/`, and everything else (ABIs, addresses, helpers) in `src/lib/`.

---

## Stack

| Package | Purpose |
|---|---|
| `next` (App Router) | Framework |
| `typescript` | Language |
| `tailwindcss` (v4) | Styling — Tailwind-first, inline styles only for dynamic values |
| `shadcn/ui` | Component base — override with Tends design tokens |
| `@privy-io/react-auth` + `@privy-io/wagmi` | Wallet connection |
| `wagmi` + `viem` | Web3 hooks + Ethereum utilities |
| `@tanstack/react-query` | Async/server state (contract reads, caching) |
| `zustand` | Global client state (wallet, vault, UI) |
| `sonner` | Toast notifications |
| `gsap` | Animations |
| `next-themes` | Dark mode — OS preference default, toggle in settings |
| `lucide-react` | Icons (consistent with shadcn/ui) |
| `lightweight-charts` | Financial charts — APY history + performance on Analytics page |
| `vaul` | Bottom sheet / drawer — mobile overlay pattern (via shadcn Drawer) |
| `ethereum-blockies-base64` | Pixel-art wallet avatar — sidebar only |

---

## Folder Structure

```
frontend/
├── app/                          ← Next.js routing only. No logic, no UI here.
│   ├── (app)/                    ← Route group for authenticated app pages
│   │   ├── dashboard/
│   │   │   └── page.tsx          ← renders <Dashboard /> from modules/
│   │   ├── activity/
│   │   │   └── page.tsx          ← renders <Activity /> from modules/
│   │   ├── analytics/
│   │   │   └── page.tsx          ← renders <Analytics /> from modules/
│   │   └── settings/
│   │       └── page.tsx          ← renders <Settings /> from modules/
│   ├── layout.tsx                ← root layout, font setup, ThemeProvider
│   └── providers.tsx             ← Privy + wagmi + TanStack Query + next-themes
│
├── src/
│   ├── components/
│   │   ├── elements/             ← Small reusable primitives with variants
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── ...
│   │   └── layouts/              ← Large reusable layout components
│   │       ├── Sidebar.tsx       ← includes WS status dot indicator
│   │       ├── Navbar.tsx
│   │       ├── DefaultLayout.tsx
│   │       ├── ChatBubble.tsx    ← floating chat trigger (bottom-right)
│   │       └── ...
│   │
│   ├── modules/                  ← One folder per feature / page
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx     ← renders onboarding overlay if !hasVault
│   │   │   └── component/
│   │   ├── onboarding/           ← overlay, NOT a route — rendered inside Dashboard.tsx
│   │   │   ├── Onboarding.tsx    ← main overlay, manages step state (1 → 2 → 3)
│   │   │   └── component/
│   │   │       ├── StepDeployVault.tsx   ← step 1: deploy vault
│   │   │       ├── StepSetStrategy.tsx   ← step 2: choose strategy (skippable)
│   │   │       └── StepFirstDeposit.tsx  ← step 3: first deposit (skippable)
│   │   ├── deposit/              ← modal, NOT a route — rendered inside Dashboard.tsx
│   │   │   ├── Deposit.tsx
│   │   │   └── component/
│   │   ├── withdraw/             ← modal, NOT a route — rendered inside Dashboard.tsx
│   │   │   ├── Withdraw.tsx
│   │   │   └── component/
│   │   ├── strategy/             ← slide-over, NOT a route — rendered inside Dashboard.tsx
│   │   │   ├── Strategy.tsx
│   │   │   └── component/
│   │   ├── activity/
│   │   │   ├── Activity.tsx
│   │   │   └── component/
│   │   ├── analytics/
│   │   │   ├── Analytics.tsx
│   │   │   └── component/
│   │   │       ├── ProjectionPlanner.tsx  ← scenario planner (POST /api/projection)
│   │   │       └── ApyHistoryChart.tsx    ← APY chart (GET /api/apy/history), lightweight-charts
│   │   ├── chat/                 ← floating panel, NOT a route — rendered in DefaultLayout
│   │   │   ├── Chat.tsx          ← panel (small + expandable to full-height)
│   │   │   └── component/
│   │   └── settings/
│   │       ├── Settings.tsx
│   │       └── component/
│   │
│   ├── hooks/                    ← All React hooks: SC reads, backend writes, Zustand stores
│   │   │
│   │   │   ── Write hooks (all delegate to useBackendTx) ──
│   │   ├── useBackendTx.ts       ← core signing engine: call backend → verify tx.to → sign with Privy
│   │   ├── useUserVault.ts       ← GET /api/users/me/position (vault address) + deployVault via backend
│   │   ├── useDeposit.ts         ← POST /api/users/me/prepare-deposit → sign steps (2 txs)
│   │   ├── useWithdraw.ts        ← POST /api/users/me/prepare-withdraw → sign tx
│   │   ├── useRiskLevel.ts       ← reads: SC direct | writes: POST /api/users/me/prepare-switch
│   │   │
│   │   │   ── Read hooks (SC direct via wagmi) ──
│   │   ├── usePortfolio.ts       ← SC reads: totalAssets, shares, riskPreference, paused
│   │   ├── useVaultHoldings.ts   ← SC reads: per-token balance + USD value
│   │   ├── usePrices.ts          ← SC reads: token prices from PriceFeed
│   │   ├── useUSDCBalance.ts     ← SC read: USDC balance for deposit form
│   │   ├── useAllowedTokens.ts   ← SC read: dynamic allowed tokens from vault
│   │   ├── useRebalanceWatch.ts  ← SC event: real-time Rebalanced event listener
│   │   ├── useVaultDeployedWatch.ts ← SC event: VaultDeployed event listener
│   │   │
│   │   │   ── Backend data hooks ──
│   │   ├── useActivityLog.ts     ← GET /api/users/me/activity
│   │   │
│   │   │   ── App hooks ──
│   │   ├── useVaultStore.ts      ← Zustand store (vault address, global vault state)
│   │   ├── useAuthVerify.ts      ← fire-and-forget POST /api/auth/verify after login
│   │   ├── useChat.ts            ← chat SSE stream (POST /api/chat)
│   │   ├── useDashboardWS.ts     ← WebSocket /ws/dashboard, exposes status + refetch triggers
│   │   └── useIsMobile.ts        ← breakpoint detector, swap Dialog↔Drawer per viewport
│   │
│   ├── lib/                      ← Contract-related data and logic
│   │   ├── abis/
│   │   │   ├── VaultFactoryAbi.ts
│   │   │   ├── UserVaultAbi.ts
│   │   │   ├── PriceFeedAbi.ts
│   │   │   ├── AgentActivityLogAbi.ts
│   │   │   └── ERC20Abi.ts
│   │   ├── addresses.ts          ← proxy contract addresses (use these for calls)
│   │   ├── chains.ts             ← Mantle Sepolia chain config (chainId: 5003)
│   │   ├── tokens.ts             ← full token catalog: symbol, address, decimals, category
│   │   ├── errors.ts             ← parseTendsError() — contract error → user message
│   │   ├── price.ts              ← parsePriceResult(), PriceStatus type
│   │   └── api.ts                ← apiFetch() helper — authenticated fetch to backend
│   │
│   └── utils/                    ← Pure reusable helper functions
│       ├── format.ts             ← shortAddress(), formatUSDC(), formatPercent(), bpsToPercent()
│       └── ...                   ← other helpers as needed
│
├── public/
├── guides/                       ← This file + other guides
│   ├── ARCHITECTURE.md           ← folder structure, stack, conventions
│   ├── FLOWS.md                  ← all pages, states, modals, user flows
│   ├── SKILLS.md                 ← which skill to invoke per feature
│   ├── BACKEND.md                ← backend API integration guide (write ops, useBackendTx)
│   └── INTEGRATION.md            ← SC reads: ABIs, addresses, read hooks, price handling
├── DESIGN.md
```

---

## Layer Guide

### `app/` — Routing only

`page.tsx` files do one thing: render the corresponding module component.

```tsx
// app/(app)/dashboard/page.tsx
import { Dashboard } from "@/modules/dashboard/Dashboard";

export default function DashboardPage() {
  return <Dashboard />;
}
```

No logic. No hooks. No UI. Routing and module composition only.

`providers.tsx` lives in `app/` and wraps the entire app with Privy, wagmi, TanStack Query, and next-themes. See `INTEGRATION.md §1.2` for the full setup — note: replace `accentColor: "#6366f1"` with `"#1591DC"` (Tends brand blue, per `DESIGN.md`).

---

### `src/components/elements/` — Reusable primitives

Small components that can be used anywhere. Built on shadcn/ui base, styled with Tends design tokens from `DESIGN.md`.

Rules:
- Must have variants (e.g. Button: `primary | secondary | destructive`)
- No business logic — no hooks, no contract calls
- Props-driven only
- Dark mode handled via Tailwind `dark:` classes

---

### `src/components/layouts/` — Reusable layout components

Large structural components: Sidebar, Navbar, page wrappers. Used across multiple pages but contain no feature-specific logic.

---

### `src/modules/` — Feature modules

Each module owns one page or feature. The main `.tsx` file is the entry point rendered by `app/`.

```
modules/
  dashboard/
    Dashboard.tsx       ← entry point, rendered by app/(app)/dashboard/page.tsx
    component/          ← local components, only used inside Dashboard.tsx
      HoldingsTable.tsx
      AgentActivityFeed.tsx
      SummaryBar.tsx
```

Rules:
- Logic and UI live here — hooks, local state, contract calls via `hooks/`
- Local components (used only in this module) go in `component/` subfolder
- Global components (used in 2+ modules) move to `src/components/elements/`
- Local hooks (used only in this module) can live in `component/` or inline

---

### `src/hooks/` — All hooks

SC reads, backend write wrappers, event watchers, and Zustand stores.

Rules:
- One hook per file, named `use*.ts`
- **Read hooks** use `useReadContract` / `useReadContracts` from wagmi — direct SC calls
- **Write hooks** delegate to `useBackendTx` — never `useWriteContract` for user-facing actions
- All write hooks must expose: `isPending` (wallet confirmation) + `isConfirming` (on-chain)
- Zustand stores are also in this folder, named `use*Store.ts`
- Always guard with `query: { enabled: !!address }` before wallet is connected
- See `BACKEND.md` for the full write hook implementations

---

### `src/lib/` — Contract-related data and logic

ABIs, addresses, chain config, token catalog, and contract-coupled helpers.

| File | Contents |
|---|---|
| `abis/` | ABI arrays as `const` — copied from implementation addresses (not proxy) |
| `addresses.ts` | Proxy contract addresses — always call these, never implementation |
| `chains.ts` | Mantle Sepolia chain definition for wagmi/viem |
| `tokens.ts` | Full token catalog: symbol, name, address, decimals, category |
| `errors.ts` | `parseTendsError()` — maps contract errors to English user messages |
| `price.ts` | `parsePriceResult()` — handles null, stale, and available price states |
| `api.ts` | `apiFetch()` — authenticated fetch wrapper for backend REST endpoints |

---

### `src/utils/` — Pure reusable helpers

Stateless functions that format, transform, or compute — no contract coupling.

| File | Contents |
|---|---|
| `format.ts` | `shortAddress()`, `formatUSDC()`, `formatPercent()`, `bpsToPercent()` |
| *(add as needed)* | Other pure helpers |

---

## Path Aliases

`@/` maps to `src/` via `tsconfig.json`.

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### INTEGRATION.md path mapping

`INTEGRATION.md` uses `@/lib/...` and `@/hooks/...` throughout. These paths match directly — no remapping needed. Use them as-is.

### INTEGRATION.md component mapping

Component examples in `INTEGRATION.md` use a flat `components/` path. In this project they live in `modules/`:

| INTEGRATION.md | Actual path |
|---|---|
| `components/OnboardingCard.tsx` | `src/modules/onboarding/Onboarding.tsx` |
| `components/DepositForm.tsx` | `src/modules/deposit/Deposit.tsx` |
| `components/PortfolioDashboard.tsx` | `src/modules/dashboard/Dashboard.tsx` |
| `components/RiskSelector.tsx` | `src/modules/strategy/Strategy.tsx` |

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Component files | PascalCase | `StatCard.tsx`, `Dashboard.tsx` |
| Hook files | camelCase, `use` prefix | `useUserVault.ts` |
| Utility files | camelCase | `errors.ts`, `format.ts` |
| ABI files | PascalCase, `Abi` suffix | `VaultFactoryAbi.ts` |
| Zustand stores | camelCase, `Store` suffix | `useVaultStore.ts` |
| Local component folders | lowercase | `component/` |
| CSS classes | Tailwind utilities | — |
| TypeScript types | PascalCase, inline in file | `type TxState = ...` |
| Constants | SCREAMING_SNAKE_CASE | `ADDRESSES`, `VAULT_TOKENS` |

---

## Dark Mode

- **Default**: OS preference (`prefers-color-scheme`)
- **Override**: user toggle stored via `next-themes` — planned in settings/profile page
- **Strategy**: `class` — Tailwind `dark:` classes activated by `html.dark`
- **Design-first**: always design dark first per `DESIGN.md`

```tsx
// app/providers.tsx — wrap with ThemeProvider
import { ThemeProvider } from "next-themes";

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

---

## `create-next-app` Setup Notes

When running `npx create-next-app`, select:
- TypeScript: **Yes**
- ESLint: **Yes**
- Tailwind CSS: **Yes**
- `src/` directory: **Yes** ← important
- App Router: **Yes**
- Import alias: **Yes** (default `@/*`)

After setup, install additional packages:

```bash
# Web3
npm install @privy-io/react-auth @privy-io/wagmi wagmi viem

# State
npm install @tanstack/react-query zustand

# UI
npm install sonner next-themes lucide-react gsap

# shadcn/ui
npx shadcn@latest init

# Charts
npm install lightweight-charts

# Wallet avatar
npm install ethereum-blockies-base64
```

---

## Pre-build Checklist

Before implementing any module, verify:

- [ ] `app/page.tsx` only renders a module component — no logic
- [ ] SC reads go through read hooks in `hooks/` — never `fetch` to chain from modules
- [ ] Write actions use backend-prepared tx pattern — never `useWriteContract` for user actions
- [ ] Local-only components live in `component/` inside the module
- [ ] Imports use `@/` alias, not relative `../../`
- [ ] All write hooks expose `isPending` and `isConfirming`
- [ ] `parseTendsError()` used for SC read/event errors
- [ ] Backend errors surfaced via sonner toast — not swallowed
- [ ] `parsePriceResult()` used — never render `$0.00` for unavailable prices
- [ ] Dark mode: Tailwind `dark:` classes present on all components
- [ ] Privy `accentColor` set to `#1591DC` (not the default `#6366f1`)
- [ ] `noPromptOnSignature: true` set in Privy embedded wallets config
- [ ] `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_PRIVY_APP_ID` in `.env.local`
