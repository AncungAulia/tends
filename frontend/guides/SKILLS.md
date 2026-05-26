# Tends Frontend — Skills Guide

> Skill mana yang harus dipakai untuk fitur apa.
> Invoke via `/skill-name` sebelum mulai implementasi fitur tersebut.

---

## Quick Reference

| Fitur / Task | Skill |
|---|---|
| Setup `app/providers.tsx`, connect wallet | `/privy` |
| Contract reads & writes (semua hooks) | `/wagmi` |
| `parseUnits`, `formatUnits`, permit signing | `/viem` |
| Install & konfigurasi shadcn components | `/shadcn` |
| App Router setup, layout, font loading | `/next-best-practices` |
| Animasi overlay, transitions, entrance | `/gsap` |
| Build komponen UI (dashboard, cards, dll) | `/frontend-design` |
| EIP-2612 permit deposit flow | `/evm-wallet-integration` |

---

## Per-Fitur Detail

### Connect Wallet
**Skill: `/privy`**

- Setup `PrivyProvider` di `app/providers.tsx`
- `usePrivy()` — `login`, `logout`, `authenticated`
- `useWallets()` — ambil wallet address
- Konfigurasi `accentColor: "#1591DC"` (bukan default `#6366f1`)
- Login methods: wallet, email, Google

---

### App Setup (providers, layout, routing)
**Skill: `/next-best-practices`**

- Struktur `app/providers.tsx` — Privy + wagmi + TanStack Query + next-themes
- Route groups `(app)/` untuk authenticated pages
- `app/layout.tsx` — font loading (Aspekta via `@font-face`, Roboto Mono)
- `tsconfig.json` path alias `@/` → `src/`
- `src/` directory convention

---

### Semua Contract Hooks (read & write)
**Skill: `/wagmi`**

Pakai setiap kali implement hook baru di `src/hooks/`:
- `useReadContract` / `useReadContracts` — baca data dari contract
- `useWriteContract` + `useWaitForTransactionReceipt` — kirim transaksi
- `useWatchContractEvent` — real-time event listener
- `WagmiProvider` + `createConfig` setup

Hooks yang butuh skill ini:
- `useUserVault.ts` — `vaultOf`, `deployVault`
- `usePortfolio.ts` — `totalAssets`, `riskPreference`, `paused`
- `useVaultHoldings.ts` — balance per token
- `useRiskLevel.ts` — `setRiskLevel`, `setCustomAllocation`
- `useDeposit.ts`, `useWithdraw.ts`
- `useActivityLog.ts`, `usePrices.ts`
- `useRebalanceWatch.ts`, `useVaultDeployedWatch.ts`

---

### Deposit dengan EIP-2612 Permit
**Skills: `/wagmi` + `/evm-wallet-integration` + `/viem`**

Flow deposit pakai `depositWithPermit` (satu transaksi, tanpa separate approve):
- Sign typed data off-chain (`signTypedData`)
- Parse `v`, `r`, `s` dari signature
- Call `depositWithPermit(amount, receiver, deadline, v, r, s)`

Gunakan `/evm-wallet-integration` untuk memahami permit pattern sebelum implementasi `useDepositWithPermit.ts`.

---

### Format Angka & Address
**Skill: `/viem`**

- `parseUnits("100", 6)` — string → bigint untuk USDC
- `formatUnits(raw, 6)` — bigint → string untuk display
- `parseUnits` / `formatUnits` untuk 18-decimal tokens
- `shortAddress()` di `src/utils/format.ts` — bisa pakai viem utilities

---

### Komponen UI (Button, Card, Badge, Input, dll)
**Skills: `/shadcn` + `/frontend-design`**

**`/shadcn`** — untuk install dan konfigurasi komponen:
- `Dialog` → Deposit modal, Withdraw modal
- `Sheet` → Strategy slide-over
- `Button`, `Input`, `Badge`, `Card`
- Override CSS variables dengan Tends design tokens dari `DESIGN.md`

**`/frontend-design`** — untuk build komponen yang sesuai design system:
- Stat cards, Holdings table, Agent Activity feed
- Onboarding overlay steps
- Paused banner, empty states, error states
- Selalu refer ke `DESIGN.md` untuk warna, typography, spacing

---

### Dashboard Layout & Komponen
**Skill: `/frontend-design`**

Gunakan setiap kali build halaman atau komponen baru:
- `modules/dashboard/Dashboard.tsx` — layout utama
- `modules/dashboard/component/` — StatCard, HoldingsTable, AgentActivityFeed, QuickActions
- `components/layouts/Sidebar.tsx` — sidebar + bottom nav mobile
- Stat cards row, 60/40 grid layout, Quick Actions bar

---

### Animasi
**Skill: `/gsap`**

- Onboarding overlay — entrance animation (fade + scale)
- Step transitions dalam onboarding (slide antara step 1 → 2 → 3)
- Modal open/close transitions
- Sidebar entrance

Refer ke `DESIGN.md` — motion principles:
- No entrance animations pada page load
- Max 200ms untuk transisi non-semantik
- State changes (pending, success, error) boleh animate

---

### Dark Mode
**Skill: `/next-best-practices`** atau **`/shadcn`**

- `next-themes` setup di `app/providers.tsx`
- `ThemeProvider attribute="class" defaultTheme="system" enableSystem`
- Tailwind `dark:` classes di semua komponen
- shadcn sudah support dark mode via CSS variables — pastikan override sesuai `DESIGN.md`

---

## Skills yang Tidak Relevan untuk Tends

| Skill | Kenapa tidak dipakai |
|---|---|
| `/thirdweb` | Kita pakai Privy + wagmi, bukan thirdweb |
| `/framer-motion-animator` | Kita pakai GSAP |
| `/evm-foundry` / `/evm-hardhat` | Smart contract sudah di-deploy, ini untuk dev contract |
| `/remotion` | Video creation, tidak relevan |
| `/solana-dev` | Kita di EVM (Mantle), bukan Solana |
| `/celo-*` | Kita di Mantle, bukan Celo |

---

## Urutan Recommended Waktu Build

```
1. /next-best-practices   ← setup project, app router, layout
2. /privy                 ← connect wallet, providers.tsx
3. /wagmi                 ← wagmi config, contract hooks
4. /shadcn                ← install komponen base
5. /frontend-design       ← build UI per module
6. /viem                  ← format utilities, permit signing
7. /evm-wallet-integration ← deposit with permit flow
8. /gsap                  ← animasi terakhir setelah UI selesai
```
