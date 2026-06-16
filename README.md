# Tends

> Deploy your agent, fire your analyst.
> AI-managed real-world-asset portfolios on Mantle. You own the vault. Hermes does the trading. You sleep.

[![Network](https://img.shields.io/badge/network-Mantle%20Sepolia-1591DC?style=flat-square)](https://explorer.sepolia.mantle.xyz)
[![Status](https://img.shields.io/badge/status-MVP%20live-22c55e?style=flat-square)](https://tends.fun)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license)

---

## Links

- 🌐 **Website:** https://tends.fun
- 🎯 **Pitch deck:** https://canva.link/y07vqj8inrecqnf
- 🐦 **X:** https://x.com/tendsfun
- 💻 **GitHub:** https://github.com/AncungAulia/tends
- 🔌 **Live API:** https://tends-api.fly.dev
- 🔍 **Example vault on explorer:** [0xc6667F8aCd202EF42a34C68dC858761C53A8eD72](https://explorer.sepolia.mantle.xyz/address/0xc6667F8aCd202EF42a34C68dC858761C53A8eD72)

---

## Team

Built by the **Universitas Gadjah Mada Blockchain Club (UGMBCC)**.

| Member | Role on Tends | Role at UGMBCC |
|---|---|---|
| **Axel Urwawuska Atarubby** | Smart Contract + AI Engineer | President |
| **Aulia Nur Fajri** | Frontend Engineer | Frontend Lead |
| **M Ulin Asidiki** | Backend Engineer | Backend Staff |
| **Nabil Aufa Danaputra** | Frontend Engineer | Media Lead |

---

## Table of contents

- [What is Tends](#what-is-tends)
- [Hackathon tracks](#hackathon-tracks)
- [How a user uses it](#how-a-user-uses-it)
- [Architecture](#architecture)
- [What we think is new](#what-we-think-is-new)
- [Risk controls the user can set](#risk-controls-the-user-can-set)
- [Assets covered](#assets-covered)
- [Quickstart](#quickstart)
- [Deployed contracts](#deployed-contracts)
- [Tokenomics](#tokenomics)
- [Business plan](#business-plan)
- [What's next](#whats-next)
- [License](#license)

---

## What is Tends

Tends gives every user a personal ERC-4626 vault on Mantle Sepolia. The user picks a risk strategy (LOW / MEDIUM / HIGH / CUSTOM) and sets guardrails (max per asset, stop-loss, daily trade limit, tokens to avoid). **Hermes**, the autonomous rebalancer, reads the vault, computes drift against the target, plans swaps, simulates them via `eth_call`, then sends the transaction. Every action is recorded on-chain through `AgentActivityLog`.

Holding a sensible mix of treasuries, gold, equities, and crypto today means juggling three or four apps and rebalancing by hand. Tends puts that mix into one on-chain vault the user owns, and lets Hermes keep it on target within rules the user sets.

---

## Hackathon tracks

We're submitting to two Mantle Turing Test 2026 tracks:

### Primary: AI × RWA (Mantle Network track), Path B (RWA Application)
End-to-end consumer flow on top of Mantle's RWA universe. AI is not cosmetic. Hermes makes the allocation and execution decisions, and writes them on-chain.

### Secondary: BGA (AI Trading & Strategy)
Tends opens institutional-style portfolio management to retail: an auditable strategy, on-chain execution records, and risk controls the user can read and verify. We are not optimizing PnL. We are removing the analyst.

---

## How a user uses it

1. **Connect with Privy.** Email, Google, or wallet. Embedded wallet available, no seed phrase needed.
2. **Onboard.** Pick a risk preset or define a custom mix.
3. **Deploy your vault.** One transaction via `VaultFactory`. Owner = user. Agent = Hermes executor.
4. **Deposit USDC.**
5. **Hermes rebalances** on a schedule and on drift. You can check the dashboard, change the strategy, pause, withdraw, or just leave it.

---

## Architecture

### Smart contracts (Foundry, all UUPS-upgradeable)

- **`VaultFactory`** deploys one `UserVault` per user, wires owner + agent automatically.
- **`UserVault`** (ERC-4626) holds the positions, enforces on-chain caps and pause, exposes a single `rebalance(SwapInstruction[])` entry point used by Hermes.
- **`StrategyRouter`** routes swaps through whitelisted DEX adapters (real DEX on mainnet, `MockDexAdapter` on testnet for deterministic demos).
- **`PriceFeed`** UUPS, batch oracle ingestion, staleness guard. `getPriceUnsafe` for views, `getPrice` (reverts on stale) for execution.
- **`AgentActivityLog`** on-chain log every time Hermes acts, queryable for audit.

### Backend (Node, Hono, Prisma, Postgres, viem)

Hermes rebalancer pipeline:

```
read holdings
  → compute target bps
  → drop excluded tokens and renormalize
  → clamp by per-asset caps and bands
  → plan swaps through USDC
  → simulate via eth_call
  → send
```

The **same pipeline** runs from the autonomous scheduler and from the chat-driven exec, so chat cannot bypass guardrails.

- REST API: `/strategies`, `/projection`, `/position`, `/holdings`, `/agent-config`, `/agent/log/stream`, `/auth/verify`.
- Auth: Privy JWT (JWKS-verified). User records linked by walletAddress (case-insensitive lookup).
- Every rebalance writes an `AgentRun` row and a vault snapshot, powering the live PnL chart.

### Frontend (Next.js + wagmi + Privy)

- Connect, onboarding, overview (live holdings, portfolio value, agent feed), setup (strategy, guardrails, Avoid list), deposit/withdraw modals.
- The dashboard reads the same data the agent acts on: real allocation, real prices via PriceFeed, real activity log.

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│   Next.js   │───▶│   Hono API   │───▶│   Postgres   │
│  + wagmi    │    │   (Hermes)   │    │  (snapshots) │
│  + Privy    │    │              │    │              │
└──────┬──────┘    └──────┬───────┘    └──────────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                  Mantle Sepolia                      │
│  VaultFactory · UserVault · PriceFeed                │
│  StrategyRouter · AgentActivityLog                   │
└─────────────────────────────────────────────────────┘
```

---

## What we think is new

- **Per-user vault, not a pooled fund.** Each user owns their own UUPS vault. They can change strategy, pause, withdraw, or migrate without touching anyone else.
- **Guardrails enforced once, honored everywhere.** `excludedTokens`, `maxPerAssetPct`, `stopLossPct`, `dailyLimitPerDay`, drift thresholds, and per-token bands all flow through one math module (`rebalance-math.ts`). Auto-rebalancer and chat-driven swaps both call the same `applyExclusions → applyAllocationCaps → computeSwapInstructions` pipeline.
- **Simulate before send.** Every rebalance is dry-run via `eth_call`. If it would revert (insufficient balance, slippage, band breach), we skip and log it. Never broadcast a failing tx.
- **Honest projection.** `/api/projection` accepts `excludedTokens` so the user sees exactly how their Avoid list changes blended APY before they save it.

---

## Risk controls the user can set

| Knob | What it does |
|---|---|
| `maxPerAssetPct` | Global ceiling per token |
| `perTokenCapsBps` | Fine-grained per-token cap |
| `perTokenBandsBps` | Drift band per token, out-of-band triggers a rebalance |
| `stopLossEnabled` + `stopLossPct` | Emergency exit to USDC |
| `dailyLimitPerDay` | Max rebalances per UTC day |
| `driftThresholdBps` | Minimum drift before acting (dust floor) |
| `maxSlippageBps` | Per-swap slippage tolerance |
| `excludedTokens` | Avoid list, dropped from target and remaining weights renormalized to 10000 bps |

---

## Assets covered

| Category | Tokens |
|---|---|
| Stablecoins | USDC, mUSD, USDY, sUSDe, BENJI, BUIDL, VBILL |
| Bonds | CETES, GILTS, KTB, TESOURO, ACRED, ONDO |
| Commodities and metals | XAU, XAUt, XAG, XPT, WTI, XCU, URANIUM |
| Indices | USA500, USA100, KOSPI200, NIKKEI225 |
| Stocks | AAPL, AMZN, GOOGL, META, MSFT, NVDA, PLTR, TSLA |
| FX | EUR, GBP, SGD, BRL, IDR, JPY, KRW, TRY |
| Crypto LST | mETH, cmETH, WMNT |

---

## Quickstart

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Postgres ≥ 14 (or use the Fly Postgres URL we provide)
- A Privy app id (free at https://privy.io)

### Clone

```bash
git clone https://github.com/AncungAulia/tends.git
cd tends
```

### Smart contracts

```bash
cd smart-contract
forge install
forge build
forge test
# Deploy to Mantle Sepolia (needs PRIVATE_KEY and MANTLE_SEPOLIA_RPC in .env)
forge script script/Deploy.s.sol --rpc-url $MANTLE_SEPOLIA_RPC --broadcast
```

### Backend

```bash
cd backend
pnpm install
cp .env.example .env
# Fill in: DATABASE_URL, PRIVY_APP_ID, MANTLE_SEPOLIA_RPC, all *_ADDR token addresses
pnpm prisma migrate deploy
pnpm prisma generate
pnpm dev               # local dev on :3001
# or
pnpm build && pnpm start
```

Tests:

```bash
pnpm test              # 324 unit + integration tests
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env
# Fill in: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_PRIVY_APP_ID, NEXT_PUBLIC_MANTLE_SEPOLIA_RPC
pnpm dev               # local dev on :3000
```

Open http://localhost:3000 → Connect wallet → Onboarding → Deploy vault → Deposit.

### Project layout

```
tends/
├── smart-contract/       Foundry: VaultFactory, UserVault, PriceFeed, ...
├── backend/              Hono API + Hermes rebalancer + Prisma
│   ├── src/services/     rebalancer, holdings, projection, agent-config, ...
│   ├── src/api/routes/   /api/users/me/*, /api/strategies, /api/projection
│   └── prisma/           schema + migrations
├── frontend/             Next.js + wagmi + Privy
│   ├── app/(app)/        overview, agent, activity, setup, account
│   ├── src/hooks/        useUserVault, useHoldings, usePortfolio, ...
│   └── src/modules/      dashboard, deposit, withdraw, onboarding
└── README.md
```

---

## Deployed contracts

**Network:** Mantle Sepolia (chainId `5003`)
**RPC:** `https://rpc.sepolia.mantle.xyz`
**Explorer:** `https://explorer.sepolia.mantle.xyz`
**Deployer:** `0x56A2950ddE6B1040d1DCC4b4C4Fc314Bd56eFB0E`
**Agent executor (Hermes):** `0x3544CC33237DF9c340A3bf7fBa914Fd03B2DfC2a`

### Core (UUPS proxies)

| Contract | Address |
|---|---|
| VaultFactory | `0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400` |
| UserVault (implementation) | `0xfdb083371f44Cf53181350389D3217e51B431776` |
| PriceFeed | `0x7F37687840d238fBE7Ff2E66AD9ed458fa689A2A` |
| AgentActivityLog | `0x864f888330821b6025b2FE670f30E01Ee8776449` |
| StrategyRouter | `0xb2f36070E6eae3353E8e755172B477DF213ae248` |
| MockDexAdapter (testnet) | `0x4c54F58cdbE8159efB71985e1E5289cBdEced2Bd` |
| MockOracle | `0x26f9178b4082b68D8cC55874D377f9829Fc8C22d` |

### Logic implementations (behind the UUPS proxies)

| Contract | Implementation |
|---|---|
| PriceFeed | `0x020744cC10fEaD789dE205de76A2769B9A4945DE` |
| AgentActivityLog | `0x56CeD9fD5E49C1Aba1371D7aDe383DD16da76484` |
| StrategyRouter | `0xD68968cf68E9930a689e0fC9d648a898050a548A` |
| VaultFactory | `0x30c92fFadAd24Ca079227A92A33b78683D36Fde6` |

### Example user vault

| | |
|---|---|
| Vault (ERC-4626) | `0xc6667F8aCd202EF42a34C68dC858761C53A8eD72` |
| Owner | `0x56A2950ddE6B1040d1DCC4b4C4Fc314Bd56eFB0E` |

### Tokens (Mantle Sepolia)

<details>
<summary>Stablecoins and base assets</summary>

| Symbol | Address |
|---|---|
| USDC (base asset, routing medium) | `0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD` |
| mUSD | `0xADA0466303441102cb16F8eC1594C744d603f746` |
| USDY | `0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8` |
| sUSDe | `0xF76DA0ec605CFac82f1DA86080da21316C07d130` |
| BENJI | `0x56514dcf6e038ba1f77530cb9df01b2f9427ea11` |
| BUIDL | `0x92cf957248c8a695da67d91835bd02e6371e5bfd` |
| VBILL | `0xbc58f30dfaae433f5531a037365c06b98960e54a` |

</details>

<details>
<summary>Bonds</summary>

| Symbol | Address |
|---|---|
| CETES | `0x1054424a70dae9098babec332e18a0f07d37d251` |
| GILTS | `0xbea967ace62d23d335ddad03972659509e1c3559` |
| KTB | `0x10d9eb91d0a69098431fb833e666bd64455d45f3` |
| TESOURO | `0xfda1e869846776e3c182f5e105640ac48d474605` |
| ACRED | `0x3d85b13c76fc218830e3c0d2e147d1a6b8f3cdc8` |
| ONDO | `0x4e3a788cd351f73d70c85f640758d90d7c573a4d` |

</details>

<details>
<summary>Commodities and metals</summary>

| Symbol | Address |
|---|---|
| XAU | `0x5b0770513b6cd76bf225462f3ec42783e8da69a1` |
| XAUt | `0x0aa42416baccdb2fd4768b61111deb7f7d212f9b` |
| XAG | `0xf380e8b6803ad065ef0567dd20c894a55050737c` |
| XPT | `0x62e518611d5a135a50c18e5fcf3a333d6d3a0506` |
| XCU | `0xb3e1f06ac529aded2aa20aa38f4c0b4ad317e5f5` |
| WTI | `0x932e82632e80b06318ca969e33f99a54f1a04b10` |
| URANIUM | `0x1d7939e37e08802a6b86204f8e3c52ba4a6cbfba` |

</details>

<details>
<summary>Equity indices</summary>

| Symbol | Address |
|---|---|
| USA500 | `0x6956dbbeb8eca1160ae21d2d703cdf6b86525825` |
| USA100 | `0x7bb9e063dab0b53fb7b7b438548d5a8c62e3afb7` |
| KOSPI200 | `0xc43bd39225a38ce33751c55c74741834a8e82d16` |
| NIKKEI225 | `0x6289654b4197744800d761a4641ba0c4a79f5ed1` |

</details>

<details>
<summary>Stocks</summary>

| Symbol | Address |
|---|---|
| AAPL | `0xc2226548fb4332dce1e31dc317bcf61effd51375` |
| AMZN | `0x5dbc3c81dbbb39dd865ec27c66abb48150325df1` |
| GOOGL | `0xdd63da0a5ec0a76029dd49c32de7de73d8918e96` |
| META | `0x028ffc7b83ac3ec143bed5a8f14c7e49a356c793` |
| MSFT | `0x61d3e9944feff4a17854e408c5ac766a1d9adb63` |
| NVDA | `0x6ceaf0d037e628d8c08e1462f628bde4da633813` |
| PLTR | `0x56979c925faa2b84637f2991c31fd6b1b33624b0` |
| TSLA | `0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523` |

</details>

<details>
<summary>FX</summary>

| Symbol | Address |
|---|---|
| EUR | `0x781dfd2a2e6b2fb23e10a4b36691520e4bc36e2a` |
| GBP | `0x2cbc4431d40121faa5b5a6d15240285761128f5a` |
| SGD | `0x039263c8b98f62f7e2debcd277ef3f1f2baf9dce` |
| BRL | `0xd568d045d34dca3f4f24be8099a8b90779047b6a` |
| IDR | `0x37e11a01f58f973098bef434a34e7fc3be4e3041` |
| JPY | `0x718c268093b11bea78a9b84861b2e4e96e86c33b` |
| KRW | `0x42feae1f60b23feb1f5c501977af161116fe3e99` |
| TRY | `0x58061565f6f2b5c8322ee3fa2dcd6497d72e5b20` |

</details>

<details>
<summary>Crypto and LSTs</summary>

| Symbol | Address |
|---|---|
| mETH | `0xD89395Df78aaFdF86b330899d1C6189211e88750` |
| cmETH | `0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF` |
| WMNT | `0x61a4ac2678048ED431E362c14D2eC7A0B3191966` |

</details>

---

## Tokenomics

> Tends does **not** have a token at hackathon launch. The protocol works without one. The token plan below is the post-mainnet design we're targeting.

### `$TENDS` (planned, post-mainnet)

**Type:** Utility + governance, ERC-20 on Mantle.
**Total supply:** 1,000,000,000 (1 billion), fixed at TGE.

#### Distribution

| Allocation | % | Vesting |
|---|---|---|
| Community incentives (airdrop, vault-mining, referrals) | 40% | 4-year linear, no cliff. Airdrop tranche unlocks at TGE. |
| Team and contributors | 20% | 4-year linear, 1-year cliff. |
| Strategic investors | 15% | 2-year linear, 6-month cliff. |
| Protocol treasury | 15% | Unlocked at TGE, governance-controlled. |
| Ecosystem and partnerships | 10% | Discretionary, multisig. |

#### Utility

1. **Fee discount.** Stake `$TENDS` to lower the management fee on your vault. Tiers:
   - Default: 0.50% AUM / year
   - Bronze (≥ 1k staked): 0.35%
   - Silver (≥ 10k staked): 0.20%
   - Gold (≥ 50k staked): 0.10%
2. **Governance.** Token-weighted votes on protocol parameters: default risk allocations, max allowed stop-loss percentage, default slippage, new asset listings.
3. **Revenue share.** A portion of protocol fees is distributed to `$TENDS` stakers (via a `feeReceiver` contract that splits to a buyback-and-distribute module).
4. **Strategy creator rewards.** Community-curated strategies (verified vaults) earn `$TENDS` proportional to AUM and performance.

#### Revenue model (drives token value capture)

| Source | Rate | Captured by |
|---|---|---|
| Management fee | 0.10 to 0.50% AUM / year (depends on stake tier) | Protocol treasury |
| Performance fee (optional, B2B mode) | 10% of alpha above benchmark | Protocol treasury |
| White-label licensing | Per-vault monthly fee | Protocol treasury |
| Asset listing | One-time fee for premium listing (governance-gated) | Protocol treasury |

Of protocol revenue: **50% to stakers, 30% to treasury, 20% to buyback-and-burn.**

#### Anti-extractive design

- No protocol-side trading fees taken from rebalances.
- No spread markup on swaps. We route through the cheapest available DEX path.
- Fees only on AUM (transparent and predictable) and optional performance fee (opt-in, B2B).

---

## Business plan

### Target users

| Segment | Why they care | How we reach them |
|---|---|---|
| Retail crypto users wanting RWA exposure | RWA tokens exist but managing allocation by hand is tedious | Direct via tends.fun, X, Mantle ecosystem channels |
| Emerging-market savers (Indonesia, LATAM, SEA) | Currency hedging into USD, gold, US equities without a brokerage account | Local partnerships, fiat onramp integrations |
| Crypto-native teams managing treasury | Multi-asset diversification with on-chain auditability | Direct B2B, governance proposal templates |
| Asset managers and fintechs | White-label the vault + agent to offer "AI-managed RWA" to their users | B2B sales, API + SDK |

### Revenue model

1. **AUM fee** on retail vaults (0.1 to 0.5% per year, tiered by `$TENDS` stake).
2. **B2B white-label** license for asset managers and exchanges who want to embed Tends.
3. **Premium listing fees** for new asset issuers wanting their token in the default strategies.

### Go-to-market phases

**Phase 1 (now, hackathon to Q1):** Ship MVP on Mantle Sepolia → win hackathon → onboard the first 1,000 retail users on Mantle mainnet at launch.

**Phase 2 (Q2 to Q3):** Real DEX adapter, fiat onramp partner, mobile-first UI. Partnerships with one or two RWA token issuers (e.g. Ondo, BlackRock BUIDL).

**Phase 3 (Q4 to year 2):** B2B white-label SDK. Partnerships with regional fintechs in SEA and LATAM. `$TENDS` TGE and listing.

**Phase 4 (year 2 plus):** Cross-chain expansion (only where the RWA universe also exists), governance handoff to a DAO, strategy marketplace.

### Why we win

- **We don't compete with token issuers.** Tends is a layer on top. Every new RWA token on Mantle makes Tends better, not worse.
- **Per-user vault architecture** means we never custody pooled funds. The user can withdraw anytime regardless of protocol state. Less regulatory exposure, less platform risk.
- **AI as the wedge.** Most RWA dApps are exchanges (buy / sell). Tends is the first agent-driven, set-and-forget allocator on Mantle's RWA universe.
- **Mantle-native.** Tokenized RWA universe lives here. Low gas makes frequent rebalances economically viable for small accounts.

---

## What's next

- [ ] Mainnet deploy on Mantle once feed coverage is stable.
- [ ] Real DEX adapter wired into `StrategyRouter` (replace `MockDexAdapter`).
- [ ] Fiat onramp integration (Privy + Transak or local IDR/BRL providers).
- [ ] B2B white-label mode for asset managers and exchanges.
- [ ] Cross-vault analytics for operators who want to see how multiple user vaults perform under the same strategy.
- [ ] Strategy marketplace where third parties can publish vetted strategies and earn `$TENDS`.
- [ ] DAO handoff and `$TENDS` TGE.

---

## Compliance posture

- USDC is the base asset and the only routing medium, so positions are always priced against a transparent unit of account.
- `excludedTokens` lets users (or, in a B2B deploy, an operator) keep assets out of the portfolio for jurisdiction or policy reasons without touching the strategy code.
- Privy auth gives a clean place to bolt KYC on top when the asset class requires it.
- The protocol never custodies pooled retail funds. Each user owns their own vault, full withdraw rights at any block.

---

## Status

- **324** backend unit + integration tests passing.
- **Live backend:** https://tends-api.fly.dev
- **Live deploys on Mantle Sepolia** (chainId 5003).
- **Auto-rebalancer running** on test vaults, on-chain logs visible via `AgentActivityLog`.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Acknowledgements

Built for **Mantle Turing Test 2026** by **UGMBCC** (Universitas Gadjah Mada Blockchain Club).
Special thanks to Mantle, BGA, and the Privy team for the dev tools and infra.

---

<p align="center">
  <a href="https://tends.fun">tends.fun</a> ·
  <a href="https://x.com/tendsfun">@tendsfun</a> ·
  <a href="https://github.com/AncungAulia/tends">github.com/AncungAulia/tends</a>
</p>
