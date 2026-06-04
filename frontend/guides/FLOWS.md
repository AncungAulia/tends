# Tends Frontend — Flows Guide

> Defines every page, state, modal, and user flow in the app.
> Read alongside `DESIGN.md`, `INTEGRATION.md`, and `ARCHITECTURE.md`.

---

## App Structure

Tends is a **dashboard-centric app**. There are four routes. All actions (deposit, withdraw, strategy) happen as modals or panels — the user never navigates away from the dashboard to perform an action.

```
/dashboard   ← main view, always here
/activity    ← agent activity log (data from backend)
/analytics   ← projection planner + APY history chart
/settings    ← appearance, preferences, wallet
```

Sidebar navigation:

```
┌─────────────────┐
│  Tends.         │
│                 │
│  ● Portfolio    │
│  ○ Activity     │
│  ○ Analytics    │
│  ○ Settings     │
│                 │
│  ● connected    │  ← WebSocket status dot
│  0x1234...5678  │
└─────────────────┘
```

WebSocket status dot (bottom of sidebar, above wallet address):
- Green dot `●` → connected to `/ws/dashboard`
- Yellow dot `●` → connecting / reconnecting
- Grey dot `●` → disconnected

---

## /dashboard — State Machine

`/dashboard` handles four distinct states in sequence. Always check in this order. After wallet connects, `useAuthVerify` fires `POST /api/auth/verify` once in the background (non-blocking).

```
open /dashboard
       │
       ▼
  wallet connected?
  ├── NO  → show Connect Prompt
  └── YES → check vault
              │
              ▼
         vault exists?
         ├── NO  → show Onboarding Overlay
         └── YES → show Dashboard
                     │
                     ▼
                vault paused?
                ├── YES → show Paused Banner + disable deposit
                └── NO  → normal dashboard
```

---

## State 1 — Connect Prompt

Shown when: wallet not connected.

```
┌─────────────────────────────────────────────────────────┐
│ Tends.                                                  │
├─────────┬───────────────────────────────────────────────┤
│         │                                               │
│ Port.   │                                               │
│ Activity│              Tends.                           │
│ Settings│                                               │
│         │      AI-managed RWA portfolio                 │
│         │      on Mantle blockchain.                    │
│         │                                               │
│         │           [Connect Wallet]                    │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

- Privy modal opens on button click
- Login methods: wallet, email, Google (per `INTEGRATION.md §1.2`)
- After connect → fire `POST /api/auth/verify` in background (non-blocking, via `useAuthVerify`)
- After connect → immediately check `vaultOf(address)`

---

## State 2 — Onboarding Overlay (3 steps)

Shown when: wallet connected, `vaultOf(address) === 0x000...`.

Dashboard content is visible but blurred and non-interactive. Full-screen overlay, centered modal. Step state managed in `modules/onboarding/Onboarding.tsx`.

```
step 1 → step 2 → step 3 → overlay closes, dashboard populates
               ↓         ↓
             skip       skip   (go straight to dashboard)
```

### Step 1 — Deploy Vault

```
┌─────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░  ┌───────────────────────────────────────────────┐  ░ │
│ ░  │  ● ─ ─                                        │  ░ │
│ ░  │                                               │  ░ │
│ ░  │  Deploy Your Vault                            │  ░ │
│ ░  │  A personal smart contract that holds and    │  ░ │
│ ░  │  manages your RWA portfolio on Mantle.        │  ░ │
│ ░  │                                               │  ░ │
│ ░  │  · Agent Hermes rebalances automatically     │  ░ │
│ ░  │  · You can withdraw anytime                  │  ░ │
│ ░  │  · One-time deployment                       │  ░ │
│ ░  │                                               │  ░ │
│ ░  │  Network   Mantle Sepolia                     │  ░ │
│ ░  │                                               │  ░ │
│ ░  │           [    Deploy Vault    ]              │  ░ │
│ ░  └───────────────────────────────────────────────┘  ░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────┘
```

Button states:
```
idle        →  [ Deploy Vault ]
pending     →  [ Confirm in wallet... ]
confirming  →  [ Deploying vault... ]
success     →  advance to step 2
error       →  [ Failed. Try again. ]  + inline error message
```

- Uses `deployVault()` from `hooks/useUserVault.ts`
- No skip on step 1 — vault is required to proceed
- On success: `refetch()` vault address, advance to step 2

---

### Step 2 — Set Strategy

```
┌───────────────────────────────────────────────┐
│  ● ● ─                                        │
│                                               │
│  Choose Your Strategy                         │
│  Hermes will rebalance your vault             │
│  according to your risk preference.           │
│                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  LOW   │ │ MEDIUM │ │  HIGH  │ │ CUSTOM │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ │
│                                               │
│  [ Skip for now ]         [ Continue ]        │
└───────────────────────────────────────────────┘
```

- Uses `setRiskLevel()` from `hooks/useRiskLevel.ts`
- CUSTOM: shows bps inputs inline (same as strategy slide-over)
- Skip: advance to step 3 without saving — vault defaults to LOW
- Continue: save strategy on-chain, then advance to step 3

---

### Step 3 — First Deposit

```
┌───────────────────────────────────────────────┐
│  ● ● ●                                        │
│                                               │
│  Make Your First Deposit                      │
│  Agent Hermes begins working as soon          │
│  as funds are in your vault.                  │
│                                               │
│  Amount                  Balance: 500 USDC    │
│  ┌───────────────────────────────┐  [Max]    │
│  │  100                          │           │
│  └───────────────────────────────┘           │
│  ≈ $100.00                                    │
│                                               │
│  [ Skip for now ]         [ Deposit ]         │
└───────────────────────────────────────────────┘
```

- Uses `depositWithPermit()` from `hooks/useDepositWithPermit.ts`
- Skip: overlay closes, dashboard renders (empty state)
- Deposit success: overlay closes, dashboard renders with holdings populated

---

## State 3 — Dashboard (normal)

Shown when: wallet connected + vault exists + vault not paused.

```
┌─────────────────────────────────────────────────────────┐
│ Tends.              Portfolio                           │
├─────────┬───────────────────────────────────────────────┤
│         │                                               │
│ ●Port.  │ ┌──────────┐┌──────────┐┌──────────┐┌──────┐│
│ Activity│ │ Total    ││ Risk     ││ Last     ││Status ││
│ Settings│ │ $12,450  ││ LOW      ││ 2h ago   ││Active ││
│         │ └──────────┘└──────────┘└──────────┘└──────┘│
│         │                                               │
│         │ ┌──────────────────────┐┌────────────────────┐│
│         │ │ Holdings             ││ Agent Activity     ││
│         │ │                      ││                    ││
│         │ │ XAU   0.023  $47.20  ││ Rebalanced  2h ago ││
│         │ │ AAPL  1.21   $228.90 ││ Rebalanced  1d ago ││
│         │ │ BUIDL 100.0  $100.05 ││ Strategy    3d ago ││
│         │ │                      ││                    ││
│         │ └──────────────────────┘└────────────────────┘│
│         │                                               │
│         │      [Deposit]  [Withdraw]  [Strategy]        │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

### Stat Cards

| Card | Data source | Format |
|---|---|---|
| Total Portfolio | `totalAssets` from `usePortfolio` | `$12,450.00` |
| Risk Level | `riskPreference` from `usePortfolio` | `LOW / MEDIUM / HIGH / CUSTOM` |
| Last Rebalance | `lastRebalanceTime` from `usePortfolio` | relative time (`2h ago`) |
| Status | `paused` from `usePortfolio` | `Active` (green) / `Paused` (yellow) |

### Holdings Table

- Data: `useVaultHoldings` — balance + price per token
- Sort: by USD value, descending
- Rows with `balance === 0n` not rendered
- Price unavailable → render `--` not `$0.00` (see `parsePriceResult` in `lib/price.ts`)
- All numbers: Roboto Mono, right-aligned
- Columns: Symbol · Balance · Value (USD) · Allocation %

### Agent Activity Preview

- Data: `useVaultActivity(vaultAddress, 5n)` — last 5 entries
- Shows: action + relative timestamp
- "View all" link → navigates to `/activity`

### Quick Actions

Three buttons at the bottom:
- `[Deposit]` → opens Deposit Modal
- `[Withdraw]` → opens Withdraw Modal
- `[Strategy]` → opens Strategy Slide-over

---

## State 4 — Dashboard (vault paused)

Shown when: `paused === true`.

```
┌─────────────────────────────────────────────────────────┐
│ ⚠  Vault paused by agent. Deposits temporarily         │
│    unavailable. Withdrawals remain open.                │
├─────────┬───────────────────────────────────────────────┤
│         │ ┌──────────┐┌──────────┐┌──────────┐┌──────┐│
│         │ │ $12,450  ││ LOW      ││ 2h ago   ││⚠PAUSE││  ← yellow
│         │ └──────────┘└──────────┘└──────────┘└──────┘│
│         │                                               │
│         │         ... holdings + activity ...           │
│         │                                               │
│         │  [Deposit ✗]   [Withdraw ✓]   [Strategy]     │
│         │       ↑
│         │    hover → "Deposits unavailable — vault paused"
└─────────┴───────────────────────────────────────────────┘
```

- Warning banner: full-width, persistent, cannot be dismissed
- Status card: yellow background, `⚠ PAUSED` label
- Deposit button: disabled + tooltip on hover
- Withdraw button: always enabled — withdrawal cannot be blocked by contract design
- Strategy button: enabled

---

## State 5 — Empty Dashboard (first deposit)

Shown when: vault exists, `totalAssets === 0`, no holdings yet.

```
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Total    ││ Risk     ││ Last     ││ Status   │
│ $0.00    ││ --       ││ --       ││ Active   │
└──────────┘└──────────┘└──────────┘└──────────┘

┌──────────────────────┐┌────────────────────────┐
│ Holdings             ││ Agent Activity         │
│                      ││                        │
│  No holdings yet.    ││  No activity yet.      │
│  Agent Hermes begins ││  Agent Hermes begins   │
│  after first deposit.││  after first deposit.  │
│                      ││                        │
│  [Deposit USDC]      ││                        │
└──────────────────────┘└────────────────────────┘

      [Deposit]  [Withdraw]  [Strategy]
```

- Stat cards visible but show `$0.00` and `--`
- Holdings empty state: message + `[Deposit USDC]` shortcut button
- Activity empty state: message only
- Quick Actions bar still present

---

## Modal: Deposit

Trigger: `[Deposit]` button in Quick Actions.

Full-screen overlay, centered modal.

```
┌─────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░  ┌───────────────────────────────────────────────┐  ░ │
│ ░  │  Deposit USDC                            [✕]  │  ░ │
│ ░  │                                               │  ░ │
│ ░  │  Amount                    Balance: 500 USDC  │  ░ │
│ ░  │  ┌─────────────────────────────────┐  [Max]  │  ░ │
│ ░  │  │  100                            │         │  ░ │
│ ░  │  └─────────────────────────────────┘         │  ░ │
│ ░  │  ≈ $100.00                                    │  ░ │
│ ░  │                                               │  ░ │
│ ░  │           [       Deposit       ]             │  ░ │
│ ░  └───────────────────────────────────────────────┘  ░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────┘
```

Button states:
```
idle        →  [ Deposit ]
pending     →  [ Confirm in wallet... ]
confirming  →  [ Waiting for confirmation... ]
success     →  modal closes + sonner toast "Deposit confirmed."
error       →  [ Failed. Try again. ]  + inline error below input
```

- Uses `depositWithPermit` (single tx, no separate approve) — `hooks/useDepositWithPermit.ts`
- Amount input: validates > 0 and ≤ balance before enabling button
- Max button: fills input with full USDC balance
- USD preview updates live as user types
- On close (✕ or backdrop click): only if not mid-transaction

---

## Modal: Withdraw

Trigger: `[Withdraw]` button in Quick Actions.

Full-screen overlay, centered modal. Same pattern as Deposit.

```
┌───────────────────────────────────────────────┐
│  Withdraw USDC                           [✕]  │
│                                               │
│  Amount               Available: $12,450.00   │
│  ┌─────────────────────────────────┐  [Max]  │
│  │  500                            │         │
│  └─────────────────────────────────┘         │
│  ≈ $500.00                                    │
│                                               │
│           [       Withdraw       ]            │
└───────────────────────────────────────────────┘
```

Button states: same pattern as Deposit.

- Max button → calls `redeemAll(shares)` (full exit)
- Partial amount → calls `withdraw(amount, receiver, owner)`
- Always enabled regardless of vault paused state
- Uses `hooks/useWithdraw.ts`

---

## Panel: Strategy

Trigger: `[Strategy]` button in Quick Actions.

Slide-over from the right. Full-screen overlay behind the panel.

```
┌──────────────────────────────┬──────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  Change Strategy    [✕]  │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ ├────────────┬─────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │            │             │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ● LOW     │  LOW        │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │            │             │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ○ MEDIUM  │  Conservative│
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │            │  bonds and  │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ○ HIGH    │  stablecoin │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │            │  yield.     │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ○ CUSTOM  │             │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ ├────────────┴─────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │         [Save Strategy]  │
└──────────────────────────────┴──────────────────────────┘
```

When CUSTOM is selected, right panel becomes allocation form:

```
│  ○ CUSTOM  ←  │  Custom Allocation          │
│               │                             │
│               │  Low    [____] %            │
│               │  Medium [____] %            │
│               │  High   [____] %            │
│               │                             │
│               │  Total: 87% ✗  (must = 100%)│
```

- Validation: `low + medium + high` must equal exactly `100%` (10000 bps)
- Save button disabled until total === 100%
- Total shown in real-time as user types
- Uses `hooks/useRiskLevel.ts` — `setRiskLevel()` or `setCustomAllocation()`
- On save success: panel closes + toast "Strategy updated."

### Strategy Data Sources

| Data | Source |
|---|---|
| Strategy names, descriptions, allocations | Hardcoded — static, never changes |
| `apyLabel`, `blendedApyPct` per strategy | **Backend** — `GET /api/strategies` (no auth) |
| Current active strategy | SC — `riskPreference` from `usePortfolio` |

APY label ditampilkan di setiap strategy card (kanan panel), di-fetch saat panel dibuka. Kalau fetch gagal → tampilkan `--` bukan error.

---

## /activity — Activity Log

```
┌─────────────────────────────────────────────────────────┐
│ Tends.              Activity                            │
├─────────┬───────────────────────────────────────────────┤
│         │                                    [⊞][≡]    │
│ Port.   │  ← table/timeline toggle, persisted to       │
│ ●Activity│    localStorage                              │
│ Settings│                                               │
│         │  TABLE VIEW:                                  │
│         │  ┌──────────┬──────────────┬───────────────┐ │
│         │  │ Time     │ Action       │ Detail        │ │
│         │  ├──────────┼──────────────┼───────────────┤ │
│         │  │ 2h ago   │ Rebalanced   │ XAU → AAPL   │ │
│         │  │ 1d ago   │ Rebalanced   │ BUIDL → XAU  │ │
│         │  │ 3d ago   │ Strategy     │ → LOW         │ │
│         │  └──────────┴──────────────┴───────────────┘ │
│         │                                               │
│         │  TIMELINE VIEW:                               │
│         │  │                                            │
│         │  ●── 2h ago  Rebalanced                      │
│         │  │           XAU → AAPL                      │
│         │  │                                            │
│         │  ●── 1d ago  Rebalanced                      │
│         │  │           BUIDL → XAU                     │
│         │  │                                            │
│         │  ●── 3d ago  Strategy updated → LOW           │
└─────────┴───────────────────────────────────────────────┘
```

- View toggle: icons in top-right of content area
- Default view: Table
- Preference persisted to `localStorage` key `tends_activity_view`
- Data: **backend** — `GET /api/users/me/activity` via `apiFetch` (not on-chain)
- **Loading state**: skeleton rows — 6x `<ActivityRowSkeleton />` (3 columns shimmer)
- Empty state: "No activity yet. Agent Hermes begins working after your first deposit."

---

## /analytics — Analytics

```
┌─────────────────────────────────────────────────────────┐
│ Tends.              Analytics                           │
├─────────┬───────────────────────────────────────────────┤
│         │                                               │
│ Port.   │  Projection                    ← full-width  │
│ Activity│  ┌──────────────────────────────────────────┐ │
│ ●Analyt.│  │  Strategy   [LOW ▼]   Capital  [10000]   │ │
│ Settings│  │  Duration   [180 days]                   │ │
│         │  │                                          │ │
│         │  │  Base     $10,892.50                     │ │
│         │  │  Best     $11,340.00   ↑                 │ │
│         │  │  Worst    $10,450.00   ↓                 │ │
│         │  └──────────────────────────────────────────┘ │
│         │                                               │
│         │  APY History                   ← full-width  │
│         │  ┌──────────────────────────────────────────┐ │
│         │  │  [mETH ▼]  [7d] [30d] [90d]              │ │
│         │  │                                          │ │
│         │  │  ▁▂▃▄▅▆▇█  (lightweight-charts line)    │ │
│         │  │                                          │ │
│         │  └──────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────┘
```

Layout: **stacked full-width** — Projection di atas, APY History di bawah. Keduanya `w-full`. Tidak ada side-by-side — chart butuh lebar penuh agar terbaca.

### Loading State

- Projection section: skeleton block `h-32 w-full` + 3x skeleton result rows
- APY History section: `<ApyChartSkeleton />` — `h-48 w-full` shimmer block
- Both sections load independently — skeleton per section, not full-page

### Projection Planner

- Inputs: Strategy (LOW / MEDIUM / HIGH / CUSTOM), Capital (number), Duration (days)
- CUSTOM strategy: shows bps allocation inputs (same pattern as Strategy slide-over)
- On change: calls `POST /api/projection` and updates results inline
- Results: Base, Best, Worst projections in USDC
- No auth required — public endpoint
- Component: `modules/analytics/component/ProjectionPlanner.tsx`

### APY History Chart

- Inputs: Asset selector (mETH, USDA, etc.), time range (7d / 30d / 90d)
- Calls `GET /api/apy/history?asset=mETH&days=30`
- Chart: `lightweight-charts` line chart — single line, minimal axes
- No auth required
- Component: `modules/analytics/component/ApyHistoryChart.tsx`

---

## Chat — Floating Panel

Chat is a floating panel anchored to the bottom-right corner of every authenticated page. It is **not a route** — rendered inside `DefaultLayout.tsx`.

```
Collapsed state:
┌──────────────────────────────────────────────────────────┐
│  (page content)                         [ Hermes AI  ↑ ] │
└──────────────────────────────────────────────────────────┘

Expanded state (small panel):
┌──────────────────────────────┬──────────────────────────┐
│  (page content, dimmed)      │  Hermes                [✕]│
│                              ├──────────────────────────┤
│                              │  Hello! I'm Hermes, your  │
│                              │  AI portfolio manager...  │
│                              │                           │
│                              │  [user message]           │
│                              │  [hermes reply]           │
│                              ├──────────────────────────┤
│                              │  ┌──────────┐  [Send]    │
│                              │  │ message  │            │
│                              │  └──────────┘            │
│                              │                [⤢ expand]│
└──────────────────────────────┴──────────────────────────┘

Full-height expanded state (press ⤢):
┌────────┬────────────────────────────────────────────────┐
│ (blurred│  Hermes                                   [✕] │
│  behind)│                                              │
│        │  [conversation history]                       │
│        │  [streaming reply...]                         │
│        ├──────────────────────────────────────────────┤
│        │  ┌───────────────────────┐  [Send]           │
│        │  │ message               │                   │
│        │  └───────────────────────┘         [⤡ shrink]│
└────────┴────────────────────────────────────────────────┘
```

- Trigger: `ChatBubble.tsx` in `components/layouts/` — always visible when authenticated
- Panel state: collapsed → small panel → full-height (toggle with ⤢/⤡ button)
- **Desktop dimensions**: small panel `w-[380px]`, full-height `w-[520px]`, always `h-screen` anchored right
- **Mobile**: bottom sheet via shadcn Drawer — `snapPoints={[0.5, 0.92]}`, half-height default
- Streaming: SSE via `POST /api/chat` — replies stream token by token
- Message history: local React state only (no persistence across sessions)
- Auth required — passes Privy token in Authorization header
- Hook: `useChat.ts` — exposes `{ messages, sendMessage, streaming }`
- While streaming: send button disabled, input disabled
- Hermes typing: show cursor `|` at end of reply while `streaming === true`
- Error: inline "Hermes is unavailable. Try again." — non-blocking

---

## /settings — Settings

```
┌─────────────────────────────────────────────────────────┐
│ Tends.              Settings                            │
├─────────┬───────────────────────────────────────────────┤
│         │                                               │
│ Port.   │  ┌──────────────────────────────────────┐    │
│ Activity│  │  [identicon]  0x1234...5678   [copy]  │    │
│ ●Settings│  │               via Google              │    │
│         │  └──────────────────────────────────────┘    │
│         │                                               │
│         │  Appearance                                   │
│         │  ┌──────────────────────────────────────┐    │
│         │  │  Theme   [System] [Light] [Dark]      │    │
│         │  └──────────────────────────────────────┘    │
│         │                                               │
│         │  Preferences                                  │
│         │  ┌──────────────────────────────────────┐    │
│         │  │  Activity view  [Table] [Timeline]   │    │
│         │  └──────────────────────────────────────┘    │
│         │                                               │
│         │  ┌──────────────────────────────────────┐    │
│         │  │  [Disconnect Wallet]                  │    │
│         │  └──────────────────────────────────────┘    │
└─────────┴───────────────────────────────────────────────┘
```

- **Loading state**: skeleton profile card (`h-16 w-full`) + skeleton rows untuk setiap section (Appearance, Preferences) — resolve langsung dari Privy user object, tidak ada async fetch
- Identicon: generated from wallet address via `jazzicon` or `blockies`
- Address: truncated `0x1234...5678` + copy button
- Connected via: from Privy user object (`user.linkedAccounts`)
- Theme: `next-themes` — System / Light / Dark, default System
- Activity view preference: synced with `/activity` page toggle via localStorage
- Disconnect: calls Privy `logout()`, redirects to `/dashboard` (connect prompt state)

---

## Error Handling

All contract errors → `parseTendsError()` from `lib/errors.ts`.

| Error | User-facing message |
|---|---|
| `VaultAlreadyExists` | You already have a vault. |
| `VaultPaused` | Vault is paused. Deposits unavailable, withdrawals remain open. |
| `ZeroAmount` | Amount cannot be zero. |
| `InvalidAllocationSum` | Custom allocation must total exactly 100%. |
| `StalePrice` | Price data is being updated by the oracle. |
| `unknown` | Something went wrong. Please try again. |

Error display:
- Inside modals/panels: inline below the relevant input or button
- Toast (sonner): for unexpected errors outside a form context

---

## Mobile

Sidebar collapses to a **bottom navigation bar**:

```
┌────────────────────────────────┐
│  content area                  │
├────────────────────────────────┤
│ Portfolio Activity Analytics Settings │  ← bottom nav
└────────────────────────────────┘
```

### Bottom Sheet Pattern

Semua overlay (modal, slide-over, chat panel) menggunakan **bottom sheet** di mobile — bukan centered modal atau right slide-over. Bottom sheet lebih natural untuk touch dan sesuai native mobile convention.

Library: **`vaul`** via shadcn Drawer component — `npx shadcn@latest add drawer`.

```
Desktop                          Mobile
─────────────────────────────    ────────────────────────
Deposit → centered modal         Deposit → bottom sheet
Withdraw → centered modal        Withdraw → bottom sheet
Strategy → right slide-over      Strategy → bottom sheet
Onboarding → centered modal      Onboarding → bottom sheet (full-height)
Chat panel → right panel         Chat → bottom sheet (half-height, expandable)
```

Implementasi pattern — tiap komponen cek breakpoint dan swap component:

```tsx
import { useIsMobile } from "@/lib/useIsMobile"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Drawer, DrawerContent } from "@/components/ui/drawer"

export function DepositModal({ open, onClose }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onClose}>
        <DrawerContent>
          <DepositForm onClose={onClose} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DepositForm onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}
```

`useIsMobile` sudah ada di `landing-page/lib/useIsMobile.ts` — copy ke `src/hooks/useIsMobile.ts`.

### Mobile-specific notes

- Holdings table: horizontal scroll (`overflow-x-auto`)
- Bottom sheet drag handle: shown by default via vaul
- Strategy bottom sheet: full-height (karena ada 4 strategy options + form)
- Onboarding bottom sheet: `snapPoints={[0.92]}` — hampir full screen, backdrop blur
- Chat bottom sheet: default `snapPoints={[0.5, 0.92]}` — half-height default, bisa di-drag ke full
