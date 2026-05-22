# Project Architecture — Mantle Turing Test 2026
## AI & RWA Track, Application Path

> **Tagline**: "Fire your analyst, deploy your agent."
> **Tech narrative**: "Powered by Hermes Agent framework"

---

## 1. System Overview

```
┌────────────────────────────────────────────────────────────────┐
│  USER (Mobile or Desktop Browser)                              │
└───────────────────────────┬────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 15 on Vercel)                               │
│  - Truus-aesthetic UI                                          │
│  - Privy embedded wallet (social login)                        │
│  - Strategy Picker, Custom Mix Designer                        │
│  - Dashboard, Chat                                             │
│  - viem + wagmi for Mantle interaction                         │
└───────────────────────────┬────────────────────────────────────┘
                            │ REST + WebSocket
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js on Railway/Fly.io)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  API Layer (Express/Fastify)                              │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│  ┌────────────▼─────────────────────────────────────────────┐ │
│  │  Hermes Agent Runtime                                     │ │
│  │   • Portfolio Assistant (chat)                            │ │
│  │   • Yield Optimizer (cron, 1h)                            │ │
│  │   • Risk Monitor (cron, 15m)                              │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│  ┌────────────▼─────────────────────────────────────────────┐ │
│  │  Services                                                  │ │
│  │   • Indexer (RPC scraper for protocol APYs)               │ │
│  │   • Price Service (CoinGecko + cache)                     │ │
│  │   • Gas Funder (auto top-up user wallets)                 │ │
│  │   • Tx Executor (agent-authorized transactions)           │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│  ┌────────────▼─────────────────────────────────────────────┐ │
│  │  Postgres (user profiles, chat, APY history, activity)    │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────┬────────────────────────────────────┘
                            │ JSON-RPC
                            ▼
┌────────────────────────────────────────────────────────────────┐
│  MANTLE NETWORK (Sepolia → Mainnet)                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CompositeVault (ERC-4626)                                │ │
│  │  - Accepts USDC                                           │ │
│  │  - Distributes across 3 tier vaults                       │ │
│  └──────┬───────────────────────────────────────────────────┘ │
│         │                                                       │
│  ┌──────┴────────┬─────────────┬─────────────┐                │
│  ▼               ▼             ▼             ▼                 │
│ ┌──────┐    ┌──────┐    ┌──────┐    ┌────────────┐           │
│ │ Low  │    │ Med  │    │ High │    │ Composite  │           │
│ │Vault │    │Vault │    │Vault │    │ holds shares│           │
│ │(4626)│    │(4626)│    │(4626)│    │ of L/M/H    │           │
│ └──┬───┘    └──┬───┘    └──┬───┘    └────────────┘           │
│    │           │           │                                   │
│    ▼           ▼           ▼                                   │
│  Strategy Router (swap engine)                                 │
│    │                                                            │
│    ├──> Merchant Moe   ├──> Agni Finance                       │
│    └──> FusionX                                                │
│                                                                 │
│  AgentActivityLog (event emitter for verifiability)            │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Strategies

| Strategy | Allocation | Target APY | Volatility |
|---|---|---|---|
| **LOW** | 90% mUSD + 10% USDY | ~5% | Very Low |
| **MEDIUM** | 40% mUSD + 30% mETH + 30% cmETH | ~5-6% | Moderate |
| **HIGH** | 40% cmETH + 30% sUSDe + 20% mETH + 10% MNT | ~8-12% | High |
| **CUSTOM** | User-defined mix of Low/Med/High via sliders | Computed | Variable |

### Custom Strategy Mechanics

User picks ratios:
- `low_pct` + `med_pct` + `high_pct` = 100%

Backend resolves to actual asset allocation:
```
final_mUSD  = (low_pct × 90%) + (med_pct × 40%)
final_USDY  = (low_pct × 10%)
final_mETH  = (med_pct × 30%) + (high_pct × 20%)
final_cmETH = (med_pct × 30%) + (high_pct × 40%)
final_sUSDe = (high_pct × 30%)
final_MNT   = (high_pct × 10%)
```

Example: User picks 50% Low + 50% Medium
```
final_mUSD  = (0.5 × 0.9) + (0.5 × 0.4) = 0.65 = 65%
final_USDY  = (0.5 × 0.1) = 0.05 = 5%
final_mETH  = (0.5 × 0.3) = 0.15 = 15%
final_cmETH = (0.5 × 0.3) = 0.15 = 15%
```

Vault rebalances to match this allocation.

---

## 3. User Signature Flow

| Action | Sign Count | Mechanism |
|---|---|---|
| Sign up | 0 | Privy auto-create wallet |
| Deposit | 1 (seamless) | ERC-2612 permit + vault deposit |
| Pick strategy | 0 | Stored in user vault config |
| Agent rebalance internal | 0 | Agent has authority on internal swaps |
| Withdraw (dashboard) | 1 (seamless) | Standard ERC-4626 withdraw |
| Withdraw (chat) | 1 (seamless) | Same flow, chat-initiated modal |
| Switch strategy | 1 (seamless) | Atomic withdraw + redeposit |
| Top-up | 1 (seamless) | Vault deposit |

**"Seamless" means**: Privy embedded wallet handles signing in-app. No MetaMask popup. Optionally biometric (Face ID/fingerprint) confirmation.

---

## 4. Gas Sponsorship

**Mechanism**: Backend Gas Funder service auto-tops up user wallets with MNT.

```
On user wallet creation:
  → Transfer 0.1 MNT (~$0.07) to user wallet

Before any user-initiated tx:
  → Check user MNT balance
  → If < 0.05 MNT, transfer 0.1 MNT
  → User executes tx with sufficient gas

Cost projection:
  Average user does ~5-10 tx → uses 0.025-0.05 MNT
  Top-up cost per user: ~$0.05-$0.10 per active user
  For 100 demo users: $5-$10 budget
```

---

## 5. Tech Stack

### Smart Contracts
- **Solidity** + **Foundry** (test framework)
- **OpenZeppelin** ERC-4626 base
- Deploy: Mantle Sepolia (dev) → Mantle Mainnet (demo)

### Backend
- **Node.js** + **TypeScript**
- **Express** or **Fastify** for API
- **Hermes Agent** framework (Nous Research)
- **OpenRouter** for LLM (Claude Sonnet 4.6 default, swappable)
- **Postgres** for state
- **viem** + **ethers v6** for chain interaction
- **node-cron** for scheduled tasks

### Frontend
- **Next.js 15** App Router
- **Tailwind CSS** + **Framer Motion**
- **Privy SDK** for wallet
- **viem** + **wagmi** for chain interaction
- **Recharts** for projections
- **shadcn/ui** for base components (themed Truus-style)

### Infrastructure
- **Vercel** (frontend)
- **Railway** or **Fly.io** (backend)
- **Mantle Sepolia → Mainnet** (contracts)
- **CoinGecko API** (free tier, prices)
- **Mantle RPC** (public + Ankr backup)

---

## 6. Repository Structure

```
project-root/
├── contracts/                    # Foundry workspace
│   ├── src/
│   │   ├── vaults/
│   │   │   ├── BaseVault.sol
│   │   │   ├── LowVault.sol
│   │   │   ├── MediumVault.sol
│   │   │   ├── HighVault.sol
│   │   │   └── CompositeVault.sol
│   │   ├── routers/
│   │   │   └── StrategyRouter.sol
│   │   ├── logs/
│   │   │   └── AgentActivityLog.sol
│   │   ├── oracles/
│   │   │   └── OracleManager.sol
│   │   └── interfaces/
│   ├── test/
│   ├── script/
│   └── foundry.toml
│
├── backend/                      # Node.js + TS
│   ├── src/
│   │   ├── api/
│   │   ├── agents/               # Hermes Agent integration
│   │   ├── services/
│   │   │   ├── indexer.ts
│   │   │   ├── pricing.ts
│   │   │   ├── gas-funder.ts
│   │   │   └── tx-executor.ts
│   │   ├── db/
│   │   └── index.ts
│   ├── prisma/
│   └── package.json
│
├── frontend/                     # Next.js 15
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json
│
└── docs/
    ├── ARCHITECTURE.md           # this file
    ├── SMART_CONTRACTS.md
    ├── BACKEND.md
    ├── FRONTEND.md
    └── DEMO_SCRIPT.md
```

---

## 7. Phase Plan (Gate-Driven)

### Phase 0: Setup
Goal: Repos, environments, accounts ready.

Gates:
- Foundry project initialized, Mantle Sepolia deployed
- Backend skeleton + Postgres up
- Frontend Next.js + Privy connect working
- Team can deploy ke each domain (Vercel, Railway)

### Phase 1: Vault MVP
Goal: User can deposit USDC, get vault shares, withdraw.

Gates:
- LowVault deployed di Sepolia, accepts USDC deposit
- Frontend: connect wallet → deposit → see shares → withdraw works
- Backend: indexer tracks deposits/withdrawals

### Phase 2: All 4 Strategies
Goal: All vault types deployed, custom mix designer works.

Gates:
- Medium + High + Composite vaults deployed
- Custom slider UI working, projection accurate
- StrategyRouter integrates Merchant Moe (testnet mock or actual)

### Phase 3: Agent Integration
Goal: Hermes Agents operational.

Gates:
- Portfolio Assistant responds to chat queries
- Yield Optimizer triggers rebalance via cron
- Risk Monitor logs alerts
- AgentActivityLog records all agent actions

### Phase 4: Polish + Demo
Goal: Truus aesthetic, demo-ready.

Gates:
- All pages styled (landing, picker, detail, dashboard, chat)
- Demo recording complete
- Submission form drafted

### Phase 5: Mainnet Deploy
Goal: Live on Mantle Mainnet for judges.

Gates:
- All contracts deployed mainnet, verified
- Real RWA assets integrated (USDY, mETH, etc.)
- Frontend pointing to mainnet
- Demo wallet funded for judges to test

---

## 8. Team Distribution

| Member | Domain | Primary Deliverables |
|---|---|---|
| **Axel** | Smart Contracts | All vaults, router, log, oracle manager, deployment scripts, tests |
| **James** | Backend | API, Hermes Agent runtime, indexer, gas funder, tx executor |
| **Ancung** | Frontend | All pages, Truus aesthetic, Privy integration, chat UI |
| **Nabil** | AI/Signal | Prompt engineering, APY scraper, projection model, tool definitions |

Critical path dependency:
```
Axel deploys vaults to Sepolia
    ↓
James can integrate indexer + tx executor
    ↓
Nabil can wire tool definitions to live backend
    ↓
Ancung wires FE to live backend + indexer
    ↓
End-to-end testing
    ↓
Mainnet deploy
```

Parallel work possible:
- Axel + Ancung skeleton (FE with mocks while contracts dev)
- James + Nabil agent prompts (can use mock data initially)
