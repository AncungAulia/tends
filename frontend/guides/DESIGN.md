# Tends App — Design System

> Design guide for the Tends frontend app (dashboard, onboarding, portfolio management).
> Read alongside `INTEGRATION.md` before writing a single line of code.

---

## Design Direction

**"Instrument-grade"**

Tends is not a consumer app. It is a financial tool for people who take their capital seriously. The UI must reflect that: undecorated, precise, every element functional. The aesthetic of a well-machined piece of equipment — no chrome for chrome's sake, no gradients filling negative space, no friendly rounded illustrations to soften the experience.

The benchmark is not a SaaS dashboard. It is the Bloomberg Terminal, redesigned by people who care about craft but would never sacrifice legibility for style. Dense when density serves the user. Sparse when data does not warrant decoration.

**Core principles:**

1. **The data is the design.** Numbers, status, and timestamps are the primary visual elements — not hero sections, not icons, not illustration.
2. **Dark-first, always.** This is a DeFi product. The default theme is dark. Light mode is secondary. Do not design light-first and port to dark.
3. **Motion only earns its place.** No entrance animations on page load. No hover transitions that exceed 200ms unless they carry semantic meaning. State changes (pending, success, error) may animate — decorative elements may not.
4. **Consistency over creativity at the component level.** Save creative decisions for layout and typography hierarchy. Components should be predictable.

**What this is not:**
- Not a crypto exchange with neon price tickers
- Not an AI product with frosted glass and purple gradients
- Not a "friendly" fintech app with pastel cards and rounded illustrations
- Not a generic SaaS dashboard with Inter, blue primary buttons, and white backgrounds

---

## Color

Same tokens as the landing page, applied differently in the app context.

### Base Palette

| Token | Value | App Usage |
|---|---|---|
| `--color-text` | `#0C1A2B` | Primary text (light mode) |
| `--color-bg` | `#F7F9FC` | Page background (light mode) |
| `--color-surface` | `#FFFFFF` | Cards, panels, modals |
| `--color-muted` | `#5B7490` | Labels, captions, placeholders |
| `--color-border` | `#DDE8F2` | Dividers, input borders, card borders |
| `--color-blue-deep` | `#2C5EAD` | LOW strategy badge, active nav link |
| `--color-blue-primary` | `#1591DC` | Primary CTA, focus ring, active state |
| `--color-blue-light` | `#4BB8FA` | Selected state, highlight |
| `--color-blue-pale` | `#EAF4FC` | Info badge background, chip background |

### Status Colors

Defined outside the brand palette. Used only for feedback states — never for decoration.

| Status | Value | Usage |
|---|---|---|
| Success | `#16A34A` | Transaction confirmed, vault active |
| Warning | `#D97706` | Stale price, vault paused |
| Error | `#DC2626` | Transaction failed, contract error |
| Neutral | `#5B7490` | Informational, muted |

### Dark Mode (Primary)

Dark is the default. Design for dark first.

| Role | Light | Dark |
|---|---|---|
| Page background | `#F7F9FC` | `#0C1A2B` |
| Surface / card | `#FFFFFF` | `#0F2035` |
| Primary text | `#0C1A2B` | `#FFFFFF` |
| Muted text | `#5B7490` | `rgba(255,255,255,0.45)` |
| Border | `#DDE8F2` | `rgba(255,255,255,0.08)` |

### Privy Accent Color

In `app/providers.tsx`, replace the default `#6366f1` (Tailwind indigo — off-brand) with the Tends brand blue:

```ts
appearance: {
  theme: "dark",
  accentColor: "#1591DC",
}
```

---

## Typography

Same font stack as the landing page:

```css
--font-sans: 'Aspekta', system-ui, sans-serif;
--font-mono: 'Roboto Mono', monospace;
```

### Type Scale

| Element | Size | Weight | Font |
|---|---|---|---|
| Page title | `1.5rem` | 700 | Aspekta |
| Section heading | `1.125rem` | 600 | Aspekta |
| Card heading | `0.875rem` | 600 | Aspekta |
| Body | `0.875rem` | 400 | Aspekta |
| Caption / label | `0.75rem` | 400 | Aspekta |
| Large data figure | `2rem–3rem` | 700 | Aspekta |
| Inline numeric data | `0.875rem` | 500 | Roboto Mono |
| Button / badge label | `0.75rem` | 400 | Roboto Mono, uppercase |
| Wallet address / hash | `0.75rem` | 400 | Roboto Mono |

### Rules

- All financial figures (`$`, percentages, token amounts) use **Roboto Mono** — digits must align across rows.
- Wallet addresses display as `0x1234...5678` (first 6, last 4 characters).
- Negative letter-spacing (`-0.02em`) on all headings.
- Uppercase only for: status badges, button labels, table column headers. Nowhere else.

---

## Spacing & Layout

### Sidebar Layout

```
+-------------+------------------------------+
|  Sidebar    |  Main Content                |
|  (240px)    |  (flex-1)                    |
|             |                              |
|  - Logo     |  Page header                 |
|  - Nav      |  --------------------------  |
|  - Wallet   |  Content grid                |
+-------------+------------------------------+
```

Mobile: sidebar collapses to a bottom navigation bar.

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `p-4` | `16px` | Card padding, mobile |
| `p-6` | `24px` | Card padding, desktop |
| `gap-4` | `16px` | Gap between cards |
| `gap-6` | `24px` | Gap between sections |

### Border Radius

| Element | Value |
|---|---|
| Card / panel | `rounded-xl` (12px) |
| Button | `rounded-lg` (8px) |
| Input | `rounded-lg` (8px) |
| Badge / chip | `rounded-full` |
| Modal | `rounded-2xl` (16px) |

---

## Components

### Button

**Primary** — main actions (Deploy, Deposit, Confirm):

```tsx
className="relative overflow-hidden inline-flex items-center gap-2
           bg-[#0C1A2B] text-white rounded-lg px-5 py-2.5
           font-mono text-xs uppercase tracking-[0.04em]
           transition-colors disabled:opacity-40"
```

**Secondary / Ghost** — secondary actions (Cancel, Back):

```tsx
className="inline-flex items-center gap-2
           border border-[#DDE8F2] text-[#5B7490] rounded-lg px-5 py-2.5
           font-mono text-xs uppercase tracking-[0.04em]
           hover:border-[#0C1A2B] hover:text-[#0C1A2B]
           dark:border-white/10 dark:text-white/45
           dark:hover:border-white/30 dark:hover:text-white
           transition-colors"
```

**Destructive** — withdraw, remove:

```tsx
className="... border border-red-200 bg-red-50 text-red-600
           hover:bg-red-100"
```

**Loading state** — every button must expose a loading state:

```tsx
disabled={isPending || isConfirming}
// Show inline spinner + contextual label, not just a disabled button
```

---

### Card

Base component for all panels:

```tsx
className="bg-white border border-[#DDE8F2] rounded-xl p-6
           dark:bg-[#0F2035] dark:border-white/8"
```

Three variants:
- **Stat card** — single large figure + label + delta
- **List card** — heading + list of items
- **Form card** — heading + input fields + primary CTA

---

### Stat Card

Displays one primary metric:

```
+------------------------+
| Total Portfolio        |
|                        |
| $12,450.00    +2.4%   |
|                        |
| Last rebalance: 2h ago |
+------------------------+
```

- Primary figure: Aspekta 700, `2rem–3rem`
- Positive delta: `#16A34A`, negative delta: `#DC2626`
- Metadata line: Roboto Mono, `0.75rem`, muted color

---

### Badge / Status Chip

```tsx
const RISK_BADGE = {
  LOW:    "bg-[#EAF4FC] text-[#2C5EAD] border border-[#2C5EAD]/20",
  MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  HIGH:   "bg-red-50    text-red-600    border border-red-200",
  CUSTOM: "bg-[#F7F9FC] text-[#5B7490] border border-[#DDE8F2]",
}

const STATUS_BADGE = {
  active:  "bg-green-50  text-green-700",
  paused:  "bg-yellow-50 text-yellow-700",
  pending: "bg-[#EAF4FC] text-[#1591DC]",
}

// Base
"inline-flex items-center px-2.5 py-0.5 rounded-full
 font-mono text-[0.65rem] uppercase tracking-[0.06em]"
```

Note: CUSTOM uses a neutral muted style, not purple. Purple is not a Tends brand color.

---

### Input

```tsx
className="w-full rounded-lg border border-[#DDE8F2] bg-white
           px-4 py-2.5 text-sm font-sans
           placeholder:text-[#5B7490]
           focus:outline-none focus:ring-2 focus:ring-[#1591DC]/20
           focus:border-[#1591DC]
           dark:bg-[#0F2035] dark:border-white/10
           dark:placeholder:text-white/30"
```

Amount inputs (USDC) must always include:
- Label with available balance shown on the right
- "Max" button
- USD value preview below the field

---

### Transaction State

Every on-chain action has four states. All four must be handled explicitly.

```
IDLE  ->  PENDING (wallet confirmation)  ->  CONFIRMING (on-chain)  ->  SUCCESS / ERROR
```

```tsx
type TxState = "idle" | "pending" | "confirming" | "success" | "error"

const TX_LABEL: Record<TxState, string> = {
  idle:       "Deposit",
  pending:    "Confirm in wallet...",
  confirming: "Waiting for confirmation...",
  success:    "Done.",
  error:      "Failed. Try again.",
}
```

Do not simply disable the button. Show the current state explicitly.

---

### Address Display

```tsx
function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

<span className="font-mono text-xs text-[#5B7490]">
  {shortAddress(address)}
</span>
```

Always pair with a small copy button. Never display a raw full-length address in the UI.

---

### Holdings Table

```
Symbol    Balance      Value (USD)    Allocation
-------------------------------------------------
XAU       0.0234       $47.20         12.4%
AAPL      1.2100       $228.90        60.1%
BUIDL     100.00       $100.05        26.3%
GOOGL     0.5000       --             --
```

- All numbers: Roboto Mono, right-aligned
- "Price unavailable" rows: render `--` in muted color, not `$0.00` — the latter implies the asset has no value
- Default sort: by USD value, descending
- Rows with `balance = 0` are not rendered
- See `parsePriceResult` in INTEGRATION.md §3.21 for price status handling

---

## Pages & Flows

### Onboarding

First-time user connects wallet and has no vault yet.

```
1. Connect Wallet  (Privy modal)
2. Check vaultOf(address) -> 0x000...  ->  no vault exists
3. Show vault creation prompt:
   - Brief explanation of what a vault is
   - "Create Vault" button -> deployVault()
   - States: idle -> pending -> deploying -> success
4. Redirect to Dashboard
```

Do not show the deposit form before the vault exists.

---

### Dashboard

Primary view after onboarding:

```
+-- Summary bar ------------------------------------------+
| Total Portfolio  |  Risk Level  |  Last Rebalance       |
+---------------------------------------------------------+

+-- Holdings ----------------+  +-- Agent Activity -------+
| Token composition table    |  | Chronological event log  |
+----------------------------+  +-------------------------+

+-- Quick Actions ----------------------------------------+
| [Deposit]   [Withdraw]   [Change Strategy]              |
+---------------------------------------------------------+
```

---

### Deposit

```
1. Enter USDC amount
2. Preview: "You are depositing X USDC"
3. [Deposit] -> depositWithPermit() — single transaction, no separate approve
4. States: pending -> confirming -> success -> dashboard update
```

Use `depositWithPermit` (INTEGRATION.md §3.3), not the two-step approve flow.

---

### Strategy

```
+-- Choose Strategy --------------------------------------+
|                                                        |
|  [LOW]      [MEDIUM]      [HIGH]      [CUSTOM]        |
|   Active                                               |
|                                                        |
|  LOW: Conservative bonds and stablecoin yield.        |
|  Minimal drawdown. Suited for capital preservation.   |
|                                                        |
|  Custom allocation:                                    |
|  Low [_30%]   Med [_40%]   High [_30%]                |
|  Total: 100% / Must equal 100% to save                |
|                                                        |
|                         [Save Strategy]               |
+---------------------------------------------------------+
```

Custom allocation: validate in real time that `low + med + high === 100%`. The save button is disabled until the total is exactly 100%.

---

## State Patterns

### Loading

Two patterns — pick based on context:

| Context | Pattern |
|---|---|
| Data panels, cards, tables not yet loaded | **Skeleton shimmer** |
| Button processing on-chain tx | **Spinner** |
| Chat Hermes streaming reply | **Spinner** |
| Inline form confirmation | **Spinner** |

---

#### Skeleton

Skeleton uses a shimmer sweep, not `animate-pulse`. Define once in `globals.css`, use via `Skeleton.tsx` primitive everywhere.

**`globals.css`**:

```css
@keyframes tends-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.tends-skeleton {
  background: linear-gradient(
    90deg,
    #DDE8F2 25%,
    #EAF4FC 50%,
    #DDE8F2 75%
  );
  background-size: 200% 100%;
  animation: tends-shimmer 1.5s ease-in-out infinite;
}

.dark .tends-skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.12) 50%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 200% 100%;
}
```

**`src/components/elements/Skeleton.tsx`**:

```tsx
import { cn } from "@/utils/cn"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("tends-skeleton rounded", className)} />
  )
}
```

Compose per-feature skeletons inside each module's `component/` folder:

```tsx
// modules/dashboard/component/StatCardSkeleton.tsx
import { Skeleton } from "@/components/elements/Skeleton"

export function StatCardSkeleton() {
  return (
    <div className="space-y-2 p-6">
      <Skeleton className="h-3 w-20" />        {/* label */}
      <Skeleton className="h-8 w-32" />        {/* figure */}
    </div>
  )
}

// modules/dashboard/component/HoldingsRowSkeleton.tsx
export function HoldingsRowSkeleton() {
  return (
    <div className="flex gap-4 px-6 py-3">
      <Skeleton className="h-4 w-10" />        {/* symbol */}
      <Skeleton className="h-4 w-20" />        {/* balance */}
      <Skeleton className="h-4 w-16" />        {/* value */}
      <Skeleton className="h-4 w-12" />        {/* allocation */}
    </div>
  )
}

// modules/analytics/component/ApyChartSkeleton.tsx
export function ApyChartSkeleton() {
  return <Skeleton className="h-48 w-full rounded-xl" />
}
```

---

#### Spinner

Three-dot rotating loader. Define in `globals.css`, use as `<span className="tends-spinner" />`.

**`globals.css`**:

```css
@keyframes tends-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tends-spinner {
  border-radius: 50%;
  display: inline-block;
  position: relative;
  background: currentColor;
  box-sizing: border-box;
  animation: tends-spin 1.5s ease-in-out infinite;
}
```

**`src/components/elements/Spinner.tsx`**:

```tsx
import { cn } from "@/utils/cn"

type SpinnerSize = "sm" | "md" | "lg"

const SIZE: Record<SpinnerSize, { box: string; shadow: string }> = {
  sm: { box: "w-2 h-2",  shadow: "[box-shadow:-14px_0_currentColor,14px_0_currentColor]" },
  md: { box: "w-2.5 h-2.5", shadow: "[box-shadow:-18px_0_currentColor,18px_0_currentColor]" },
  lg: { box: "w-3.5 h-3.5", shadow: "[box-shadow:-22px_0_currentColor,22px_0_currentColor]" },
}

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={cn(
        "tends-spinner text-[#1591DC] dark:text-[#4BB8FA]",
        SIZE[size].box,
        SIZE[size].shadow,
        className
      )}
    />
  )
}
```

Usage:

```tsx
// Inside a button
<span className="flex items-center gap-3">
  <Spinner size="sm" />
  <span>Confirming...</span>
</span>

// Chat streaming indicator
<Spinner size="sm" />
```

### Empty State

When a vault has just been created and no holdings or activity exist yet:

```tsx
<div className="flex flex-col items-center gap-3 py-12 text-center">
  <p className="font-sans text-sm text-[#5B7490]">
    No activity yet.
  </p>
  <p className="font-sans text-xs text-[#5B7490]/60">
    Agent Hermes begins working after your first deposit.
  </p>
</div>
```

Do not render an empty table. Render an empty state with context.

### Error State

```tsx
// Inline error — below a form field
<p className="text-sm text-red-500 mt-2">{errorMessage}</p>

// Page-level error — full card
<div className="rounded-xl border border-red-200 bg-red-50 p-4
                dark:border-red-900/50 dark:bg-red-950/30">
  <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
  <button onClick={retry} className="mt-2 text-xs text-red-500 underline">
    Try again
  </button>
</div>
```

Always use `parseTendsError()` from `lib/errors.ts` (INTEGRATION.md §3.12) to produce user-facing error messages from contract errors.

---

## DeFi-specific UX

### Wallet Connection

- Do not render wallet-gated content before the user is connected.
- Show a clear "Connect Wallet" prompt centered on the page — not a small button in the corner.
- After connecting, immediately check for an existing vault. Do not assume one exists.

### Number Precision

```ts
// Portfolio value — 2 decimal places
$12,450.23

// Token balance — scale with magnitude
0.0234 XAU     // small: 4 decimal places
1,234.56 USDC  // large: 2 decimal places

// Allocation percentage — 1 decimal place
32.5%

// Basis points -> display as percentage in all UI
3000 bps  ->  30%
```

### Vault Paused

When `paused === true`:
- Show a persistent warning banner at the top of the dashboard
- Disable the Deposit button with a clear reason label
- Do NOT disable the Withdraw button — withdrawal is always available by contract design
- Message: "Vault is paused by the agent. Deposits are temporarily unavailable. Withdrawals remain open."

### Price Unavailable

When `priceStatus === "unavailable"` or `"stale"`:
- Render `--` in the value column, never `$0.00`
- `$0.00` implies the asset is worthless — this is incorrect and misleading
- Tooltip on hover: "Price data is being updated by the oracle"

---

## Pre-ship Checklist

Before merging any new page or component:

- [ ] All four states handled: loading, empty, error, success
- [ ] All financial figures use Roboto Mono
- [ ] Wallet addresses are truncated and paired with a copy button
- [ ] Transaction flow covers: idle, pending, confirming, done
- [ ] Vault paused state is handled where deposits are shown
- [ ] Null / stale prices render as `--`, not `$0.00`
- [ ] Mobile layout is functional
- [ ] Dark mode has no invisible text or broken contrast
- [ ] Privy `accentColor` is set to `#1591DC`
- [ ] No purple used anywhere in the UI
