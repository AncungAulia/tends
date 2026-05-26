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
│   ├── hooks/                    ← All React hooks: contract read/write + Zustand stores
│   │   ├── useUserVault.ts       ← vaultOf, deployVault
│   │   ├── useDeposit.ts         ← approve + deposit (2-step)
│   │   ├── useDepositWithPermit.ts ← EIP-2612 permit deposit (preferred)
│   │   ├── useWithdraw.ts        ← withdraw, redeemAll
│   │   ├── usePortfolio.ts       ← totalAssets, shares, riskPreference, paused
│   │   ├── useVaultHoldings.ts   ← per-token balance + USD value
│   │   ├── useRiskLevel.ts       ← riskPreference, setRiskLevel, setCustomAllocation
│   │   ├── useActivityLog.ts     ← agent activity history
│   │   ├── usePrices.ts          ← token prices from PriceFeed
│   │   ├── useUSDCBalance.ts     ← USDC balance for deposit form
│   │   ├── useAllowedTokens.ts   ← dynamic allowed tokens from vault
│   │   ├── useRebalanceWatch.ts  ← real-time Rebalanced event listener
│   │   ├── useVaultDeployedWatch.ts ← VaultDeployed event listener
│   │   ├── useVaultStore.ts      ← Zustand store (vault address, global vault state)
│   │   ├── useAuthVerify.ts      ← fire-and-forget POST /api/auth/verify after login
│   │   ├── useChat.ts            ← chat SSE stream (POST /api/chat)
│   │   └── useDashboardWS.ts     ← WebSocket /ws/dashboard, exposes status + refetch triggers
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
│   └── BACKEND.md                ← backend API integration guide
├── DESIGN.md
└── INTEGRATION.md
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

Contract reads, contract writes, event watchers, Zustand stores, and any other React hooks that are shared across modules.

Rules:
- One hook per file, named `use*.ts`
- Contract read hooks use `useReadContract` / `useReadContracts` from wagmi
- Contract write hooks use `useWriteContract` + `useWaitForTransactionReceipt`
- All write hooks must expose: `isPending` (wallet confirmation) + `isConfirming` (on-chain)
- Zustand stores are also in this folder, named `use*Store.ts`
- Always guard with `query: { enabled: !!address }` before wallet is connected

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
```

---

## Pre-build Checklist

Before implementing any module, verify:

- [ ] `app/page.tsx` only renders a module component — no logic
- [ ] Contract calls go through `hooks/`, not directly in modules
- [ ] Local-only components live in `component/` inside the module
- [ ] Imports use `@/` alias, not relative `../../`
- [ ] `@/lib/...` and `@/hooks/...` paths from `INTEGRATION.md` are used as-is
- [ ] All write hooks expose `isPending` and `isConfirming`
- [ ] `parseTendsError()` used for all contract error handling
- [ ] `parsePriceResult()` used — never render `$0.00` for unavailable prices
- [ ] Dark mode: Tailwind `dark:` classes present on all components
- [ ] Privy `accentColor` set to `#1591DC` (not the default `#6366f1`)
