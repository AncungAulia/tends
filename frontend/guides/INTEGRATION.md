# Tends Frontend Integration Guide

Smart contract sudah di-deploy di **Mantle Sepolia Testnet**. Dokumen ini dibagi 3 bagian:

- **Part 1** — Network, Privy + wagmi setup, semua contract address
- **Part 2** — ABI files (struktur `lib/abis/`) + contract instances
- **Part 3** — Semua user flow lengkap dengan kode

Stack yang diasumsikan: **Next.js + Privy + wagmi v2 + viem**

---

# Part 1 — Network, Wallet & Contract Addresses

## 1.1 Network Configuration

```ts
// lib/chains.ts
import { type Chain } from "viem";

export const mantleSepolia: Chain = {
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz"] },
    public: { http: ["https://rpc.sepolia.mantle.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Mantlescan",
      url: "https://explorer.sepolia.mantle.xyz",
    },
  },
  testnet: true,
};
```

## 1.2 Privy + wagmi Setup

```tsx
// app/providers.tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { mantleSepolia } from "@/lib/chains";

const wagmiConfig = createConfig({
  chains: [mantleSepolia],
  transports: {
    [mantleSepolia.id]: http("https://rpc.sepolia.mantle.xyz"),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        defaultChain: mantleSepolia,
        supportedChains: [mantleSepolia],
        loginMethods: ["wallet", "email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

```tsx
// components/ConnectButton.tsx
"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function ConnectButton() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const address = wallets[0]?.address;

  if (!authenticated) {
    return <button onClick={login}>Connect Wallet</button>;
  }

  return (
    <div>
      <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
      <button onClick={logout}>Disconnect</button>
    </div>
  );
}
```

## 1.3 Core Contract Addresses

> **Penting:** Untuk call contract, selalu gunakan **proxy address**. Untuk import ABI, ambil dari **implementation** (lihat Part 2).

| Contract           | Proxy Address                                | Implementation Address                       |
|--------------------|----------------------------------------------|----------------------------------------------|
| VaultFactory       | `0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400` | `0x30c92fFadAd24Ca079227A92A33b78683D36Fde6` |
| UserVault (shared) | *(per-user, query via VaultFactory)*         | `0xfdb083371f44Cf53181350389D3217e51B431776` |
| PriceFeed          | `0x7F37687840d238fBE7Ff2E66AD9ed458fa689A2A` | `0x020744cC10fEaD789dE205de76A2769B9A4945DE` |
| AgentActivityLog   | `0x864f888330821b6025b2FE670f30E01Ee8776449` | `0x56CeD9fD5E49C1Aba1371D7aDe383DD16da76484` |
| StrategyRouter     | `0xb2f36070E6eae3353E8e755172B477DF213ae248` | `0xD68968cf68E9930a689e0fC9d648a898050a548A` |
| MockDexAdapter     | `0xB5f72a0ab0bA971c8C4F69D4A075cB7fd7859e65` | *(non-upgradeable)*                          |

```ts
// lib/addresses.ts
export const ADDRESSES = {
  VAULT_FACTORY:     "0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400",
  PRICE_FEED:        "0x7F37687840d238fBE7Ff2E66AD9ed458fa689A2A",
  ACTIVITY_LOG:      "0x864f888330821b6025b2FE670f30E01Ee8776449",
  STRATEGY_ROUTER:   "0xb2f36070E6eae3353E8e755172B477DF213ae248",
} as const;
```

## 1.4 Mock Token Addresses

### Core Tokens (deposit asset + vault collateral)

| Symbol | Address                                      | Keterangan            |
|--------|----------------------------------------------|-----------------------|
| USDC   | `0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD` | Deposit asset utama   |
| mUSD   | `0xADA0466303441102cb16F8eC1594C744d603f746` | Mantle USD            |
| USDY   | `0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8` | Yield-bearing USD     |
| mETH   | `0xD89395Df78aaFdF86b330899d1C6189211e88750` | Mantle ETH            |
| cmETH  | `0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF` | Compound mETH         |
| sUSDe  | `0xF76DA0ec605CFac82f1DA86080da21316C07d130` | Staked USDe           |
| WMNT   | `0x61a4ac2678048ED431E362c14D2eC7A0B3191966` | Wrapped MNT (native)  |

### RWA Tokens — Bonds

| Symbol  | Address                                      |
|---------|----------------------------------------------|
| CETES   | `0x1054424a70dae9098babec332e18a0f07d37d251` |
| GILTS   | `0xbea967ace62d23d335ddad03972659509e1c3559` |
| KTB     | `0x10d9eb91d0a69098431fb833e666bd64455d45f3` |
| TESOURO | `0xfda1e869846776e3c182f5e105640ac48d474605` |

### RWA Tokens — Commodities

| Symbol  | Address                                      |
|---------|----------------------------------------------|
| URANIUM | `0x1d7939e37e08802a6b86204f8e3c52ba4a6cbfba` |
| WTI     | `0x932e82632e80b06318ca969e33f99a54f1a04b10` |
| XAG     | `0xf380e8b6803ad065ef0567dd20c894a55050737c` |
| XAU     | `0x5b0770513b6cd76bf225462f3ec42783e8da69a1` |
| XAUt    | `0x0aa42416baccdb2fd4768b61111deb7f7d212f9b` |
| XCU     | `0xb3e1f06ac529aded2aa20aa38f4c0b4ad317e5f5` |
| XPT     | `0x62e518611d5a135a50c18e5fcf3a333d6d3a0506` |

### RWA Tokens — Funds

| Symbol | Address                                      |
|--------|----------------------------------------------|
| ACRED  | `0x3d85b13c76fc218830e3c0d2e147d1a6b8f3cdc8` |
| BENJI  | `0x56514dcf6e038ba1f77530cb9df01b2f9427ea11` |
| BUIDL  | `0x92cf957248c8a695da67d91835bd02e6371e5bfd` |
| ONDO   | `0x4e3a788cd351f73d70c85f640758d90d7c573a4d` |
| VBILL  | `0xbc58f30dfaae433f5531a037365c06b98960e54a` |

### RWA Tokens — FX

| Symbol | Address                                      |
|--------|----------------------------------------------|
| BRL    | `0xd568d045d34dca3f4f24be8099a8b90779047b6a` |
| EUR    | `0x781dfd2a2e6b2fb23e10a4b36691520e4bc36e2a` |
| GBP    | `0x2cbc4431d40121faa5b5a6d15240285761128f5a` |
| IDR    | `0x37e11a01f58f973098bef434a34e7fc3be4e3041` |
| JPY    | `0x718c268093b11bea78a9b84861b2e4e96e86c33b` |
| KRW    | `0x42feae1f60b23feb1f5c501977af161116fe3e99` |
| SGD    | `0x039263c8b98f62f7e2debcd277ef3f1f2baf9dce` |
| TRY    | `0x58061565f6f2b5c8322ee3fa2dcd6497d72e5b20` |

### RWA Tokens — Indices

| Symbol    | Address                                      |
|-----------|----------------------------------------------|
| KOSPI200  | `0xc43bd39225a38ce33751c55c74741834a8e82d16` |
| NIKKEI225 | `0x6289654b4197744800d761a4641ba0c4a79f5ed1` |
| USA100    | `0x7bb9e063dab0b53fb7b7b438548d5a8c62e3afb7` |
| USA500    | `0x6956dbbeb8eca1160ae21d2d703cdf6b86525825` |

### RWA Tokens — Stocks

| Symbol | Address                                      |
|--------|----------------------------------------------|
| AAPL   | `0xc2226548fb4332dce1e31dc317bcf61effd51375` |
| AMZN   | `0x5dbc3c81dbbb39dd865ec27c66abb48150325df1` |
| GOOGL  | `0xdd63da0a5ec0a76029dd49c32de7de73d8918e96` |
| META   | `0x028ffc7b83ac3ec143bed5a8f14c7e49a356c793` |
| MSFT   | `0x61d3e9944feff4a17854e408c5ac766a1d9adb63` |
| NVDA   | `0x6ceaf0d037e628d8c08e1462f628bde4da633813` |
| PLTR   | `0x56979c925faa2b84637f2991c31fd6b1b33624b0` |
| TSLA   | `0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523` |

---

# Part 2 — ABI Files

## Aturan Penting: ABI dari Implementation, bukan Proxy

Semua core contract (kecuali MockDexAdapter) menggunakan pola **UUPS Proxy**:
- **Proxy** = address yang dipanggil (call ke sini)
- **Implementation** = address yang berisi logic & ABI (ambil ABI dari sini)

Mantlescan: buka implementation address → Contract → ABI

## Struktur Folder

Buat folder `lib/abis/` dan isi file berikut:

```
lib/
  abis/
    VaultFactoryAbi.ts
    UserVaultAbi.ts
    PriceFeedAbi.ts
    AgentActivityLogAbi.ts
    ERC20Abi.ts
```

---

## `lib/abis/VaultFactoryAbi.ts`

> ABI dari implementation: `0x30c92fFadAd24Ca079227A92A33b78683D36Fde6`

```ts
export const VaultFactoryAbi = [
  {
    type: "function",
    name: "deployVault",
    inputs: [],
    outputs: [{ name: "vault", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vaultOf",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allVaults",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalVaults",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedTokens",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "implementation",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VaultDeployed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "VaultAlreadyExists",
    inputs: [],
  },
] as const;
```

---

## `lib/abis/UserVaultAbi.ts`

> ABI dari implementation: `0xfdb083371f44Cf53181350389D3217e51B431776`
>
> UserVault adalah ERC-4626 vault. Setiap user punya proxy address sendiri. Gunakan `vaultOf(userAddress)` dari VaultFactory untuk dapat proxy address-nya.

```ts
export const UserVaultAbi = [
  // ── ERC-4626 core ────────────────────────────────────────────────────────
  {
    type: "function",
    name: "asset",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToShares",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewDeposit",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewWithdraw",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxDeposit",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxWithdraw",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // ── Deposit helpers ───────────────────────────────────────────────────────
  {
    type: "function",
    name: "depositWithPermit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositNative",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "payable",
  },
  // ── Risk preference ───────────────────────────────────────────────────────
  {
    type: "function",
    name: "riskPreference",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "customAllocation",
    inputs: [],
    outputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setRiskLevel",
    inputs: [{ name: "level", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCustomAllocation",
    inputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── State ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastRebalanceTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedTokens",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAllowedToken",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Rebalanced",
    inputs: [
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "agent", type: "address", indexed: true },
      {
        name: "instructions",
        type: "tuple[]",
        indexed: false,
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RiskPreferenceUpdated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "level", type: "uint8", indexed: false },
      { name: "lowBps", type: "uint16", indexed: false },
      { name: "medBps", type: "uint16", indexed: false },
      { name: "highBps", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  // ── Errors ────────────────────────────────────────────────────────────────
  { type: "error", name: "VaultPaused", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InvalidAllocationSum", inputs: [] },
] as const;
```

---

## `lib/abis/PriceFeedAbi.ts`

> ABI dari implementation: `0x020744cC10fEaD789dE205de76A2769B9A4945DE`
>
> Harga selalu dalam skala **1e18** (18 desimal). Divide dengan `1e18` untuk dapat USD value.

```ts
export const PriceFeedAbi = [
  {
    type: "function",
    name: "getPrice",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPriceUnsafe",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updateTime", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "staticPrices",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feedIds",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "NoFeedConfigured",
    inputs: [{ name: "token", type: "address" }],
  },
  {
    type: "error",
    name: "StalePrice",
    inputs: [
      { name: "token", type: "address" },
      { name: "updatedAt", type: "uint256" },
      { name: "elapsed", type: "uint256" },
    ],
  },
] as const;
```

---

## `lib/abis/AgentActivityLogAbi.ts`

> ABI dari implementation: `0x56CeD9fD5E49C1Aba1371D7aDe383DD16da76484`
>
> Dipakai untuk menampilkan riwayat aktivitas agent (rebalance history) di dashboard.

```ts
export const AgentActivityLogAbi = [
  {
    type: "function",
    name: "totalActivities",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRecentActivities",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "result",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "vault", type: "address" },
          { name: "agent", type: "address" },
          { name: "action", type: "string" },
          { name: "metadata", type: "bytes" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActivitiesByVault",
    inputs: [
      { name: "vault", type: "address" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "result",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "vault", type: "address" },
          { name: "agent", type: "address" },
          { name: "action", type: "string" },
          { name: "metadata", type: "bytes" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ActivityLogged",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
```

---

## `lib/abis/ERC20Abi.ts`

> Minimal ABI untuk USDC dan semua mock token (approve, allowance, balanceOf, permit).

```ts
export const ERC20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "permit",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
```

---

# Part 3 — User Flows

> **ARCHITECTURE NOTE — Read before implementing write hooks.**
>
> Write operations (deploy vault, deposit, withdraw, strategy switch) go through the
> **backend API**, not direct contract calls. The backend returns an unsigned tx,
> the frontend verifies the `tx.to` address, and signs with the Privy embedded wallet.
>
> See **`guides/BACKEND.md`** for the complete implementation:
> - `src/lib/api.ts` — authenticated fetch helper
> - `src/hooks/useBackendTx.ts` — core signing engine with tx verification
> - `src/hooks/useUserVault.ts` — vault address from `/position` + deployVault
> - `src/hooks/useDeposit.ts` — `POST /api/users/me/prepare-deposit`
> - `src/hooks/useWithdraw.ts` — `POST /api/users/me/prepare-withdraw`
> - `src/hooks/useRiskLevel.ts` — reads SC direct, writes via `prepare-switch`
>
> The sections below (§3.1–3.4, §3.8) are **superseded by BACKEND.md** for write logic.
> They are kept here for ABI and read-path reference only.

---

## Arsitektur Singkat

```
User
 │
 ├─ connect wallet (Privy)
 │
 ├─ POST /api/users/me/deploy-vault → sign tx   ← satu kali per user
 │
 ├─ POST /api/users/me/prepare-deposit          ← backend returns [approveTx, depositTx]
 │     └─ sign steps[0] (USDC approve)
 │     └─ sign steps[1] (vault deposit)
 │
 ├─ POST /api/users/me/prepare-switch           ← backend returns [setRiskTx] or [setCustomTx]
 │     └─ sign tx
 │
 └─ [Agent Hermes rebalance otomatis]           ← backend, bukan user
```

**Risk Levels (on-chain `riskPreference` value):**
- `0` = LOW — alokasi konservatif (bonds, stablecoin yield)
- `1` = MEDIUM — campuran (bonds + commodities + funds)
- `2` = HIGH — agresif (stocks, commodities, high-yield)
- `3` = CUSTOM — user set manual `lowBps + medBps + highBps = 10000`

---

## 3.1 Hook: Cek & Deploy Vault

```ts
// hooks/useUserVault.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { ADDRESSES } from "@/lib/addresses";
import { VaultFactoryAbi } from "@/lib/abis/VaultFactoryAbi";

export function useUserVault() {
  const { user } = usePrivy();
  const address = user?.wallet?.address as `0x${string}` | undefined;

  // Baca vault address user (0x000... kalau belum punya vault)
  const { data: vaultAddress, refetch } = useReadContract({
    address: ADDRESSES.VAULT_FACTORY,
    abi: VaultFactoryAbi,
    functionName: "vaultOf",
    args: [address!],
    query: { enabled: !!address },
  });

  const hasVault =
    !!vaultAddress && vaultAddress !== "0x0000000000000000000000000000000000000000";

  const { writeContract, data: deployTxHash, isPending } = useWriteContract();

  const { isLoading: isDeploying, isSuccess: deployed } =
    useWaitForTransactionReceipt({ hash: deployTxHash });

  const deployVault = () => {
    writeContract({
      address: ADDRESSES.VAULT_FACTORY,
      abi: VaultFactoryAbi,
      functionName: "deployVault",
    });
  };

  return { vaultAddress, hasVault, deployVault, isPending, isDeploying, deployed, refetch };
}
```

---

## 3.2 Hook: Deposit USDC (dengan approve 2-step)

```ts
// hooks/useDeposit.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { ADDRESSES } from "@/lib/addresses";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

const USDC_ADDRESS = "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD";
const USDC_DECIMALS = 6;

export function useDeposit(vaultAddress: `0x${string}`, userAddress: `0x${string}`) {
  // Baca allowance USDC user ke vault
  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "allowance",
    args: [userAddress, vaultAddress],
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  // Step 1: approve
  const approve = (amountUSDC: string) => {
    const amount = parseUnits(amountUSDC, USDC_DECIMALS);
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20Abi,
      functionName: "approve",
      args: [vaultAddress, amount],
    });
  };

  // Step 2: deposit
  const deposit = (amountUSDC: string) => {
    const amount = parseUnits(amountUSDC, USDC_DECIMALS);
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "deposit",
      args: [amount, userAddress],
    });
  };

  const needsApproval = (amountUSDC: string) => {
    const amount = parseUnits(amountUSDC, USDC_DECIMALS);
    return !allowance || allowance < amount;
  };

  return { approve, deposit, needsApproval, isPending, isConfirming };
}
```

---

## 3.3 Hook: Deposit dengan EIP-2612 Permit (satu transaksi, UX lebih baik)

```ts
// hooks/useDepositWithPermit.ts
import { useWriteContract } from "wagmi";
import { useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { mantleSepolia } from "@/lib/chains";
import { createPublicClient, http } from "viem";

const USDC_ADDRESS = "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD";
const USDC_DECIMALS = 6;

export function useDepositWithPermit(vaultAddress: `0x${string}`, userAddress: `0x${string}`) {
  const { data: walletClient } = useWalletClient();
  const { writeContract, isPending } = useWriteContract();
  const publicClient = createPublicClient({ chain: mantleSepolia, transport: http() });

  const depositWithPermit = async (amountUSDC: string) => {
    if (!walletClient) return;

    const amount = parseUnits(amountUSDC, USDC_DECIMALS);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 jam

    // Baca nonce EIP-2612
    const nonce = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20Abi,
      functionName: "nonces",
      args: [userAddress],
    });

    // Sign permit off-chain (tidak perlu transaksi terpisah)
    const signature = await walletClient.signTypedData({
      domain: {
        name: "USD Coin",
        version: "1",
        chainId: mantleSepolia.id,
        verifyingContract: USDC_ADDRESS,
      },
      types: {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "Permit",
      message: {
        owner: userAddress,
        spender: vaultAddress,
        value: amount,
        nonce,
        deadline,
      },
    });

    // Parse v, r, s dari signature
    const v = parseInt(signature.slice(130, 132), 16);
    const r = signature.slice(0, 66) as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;

    // Satu transaksi: permit + deposit
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "depositWithPermit",
      args: [amount, userAddress, deadline, v, r, s],
    });
  };

  return { depositWithPermit, isPending };
}
```

---

## 3.4 Hook: Set Risk Level

```ts
// hooks/useRiskLevel.ts
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

// Enum RiskLevel: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CUSTOM
export enum RiskLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CUSTOM = 3,
}

export function useRiskLevel(vaultAddress: `0x${string}`) {
  const { data: currentLevel } = useReadContract({
    address: vaultAddress,
    abi: UserVaultAbi,
    functionName: "riskPreference",
  });

  const { data: customAlloc } = useReadContract({
    address: vaultAddress,
    abi: UserVaultAbi,
    functionName: "customAllocation",
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const setRiskLevel = (level: RiskLevel) => {
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "setRiskLevel",
      args: [level],
    });
  };

  // Custom: lowBps + medBps + highBps harus = 10000 (100%)
  // Contoh: 3000, 4000, 3000 = 30% / 40% / 30%
  const setCustomAllocation = (lowBps: number, medBps: number, highBps: number) => {
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "setCustomAllocation",
      args: [lowBps, medBps, highBps],
    });
  };

  return { currentLevel, customAlloc, setRiskLevel, setCustomAllocation, isPending, isConfirming };
}
```

---

## 3.5 Hook: Portfolio Data (total value + shares)

```ts
// hooks/usePortfolio.ts
import { useReadContracts } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

export function usePortfolio(vaultAddress: `0x${string}`, userAddress: `0x${string}`) {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "totalAssets",
      },
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "balanceOf",
        args: [userAddress],
      },
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "riskPreference",
      },
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "lastRebalanceTime",
      },
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "paused",
      },
    ],
    query: { enabled: !!vaultAddress && !!userAddress },
  });

  const [totalAssets, shares, riskPreference, lastRebalanceTime, paused] = data ?? [];

  // shares → USDC value (6 decimals)
  // totalAssets sudah dalam USDC decimals
  const totalAssetsUSDC = totalAssets?.result
    ? Number(totalAssets.result) / 1e6
    : 0;

  return {
    totalAssetsUSDC,
    shares: shares?.result,
    riskPreference: riskPreference?.result,
    lastRebalanceTime: lastRebalanceTime?.result,
    paused: paused?.result,
    isLoading,
  };
}
```

---

## 3.6 Hook: Harga Aset dari PriceFeed

```ts
// hooks/usePrices.ts
import { useReadContracts } from "wagmi";
import { PriceFeedAbi } from "@/lib/abis/PriceFeedAbi";
import { ADDRESSES } from "@/lib/addresses";

// Daftar token yang ingin ditampilkan harganya
const PRICE_TOKENS: { symbol: string; address: `0x${string}` }[] = [
  { symbol: "USDY",  address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8" },
  { symbol: "mETH",  address: "0xD89395Df78aaFdF86b330899d1C6189211e88750" },
  { symbol: "AAPL",  address: "0xc2226548fb4332dce1e31dc317bcf61effd51375" },
  { symbol: "XAU",   address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1" },
  { symbol: "MSFT",  address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63" },
];

export function usePrices() {
  const { data, isLoading } = useReadContracts({
    contracts: PRICE_TOKENS.map((t) => ({
      address: ADDRESSES.PRICE_FEED,
      abi: PriceFeedAbi,
      functionName: "getPriceUnsafe" as const,
      args: [t.address] as [`0x${string}`],
    })),
  });

  const prices = PRICE_TOKENS.map((token, i) => {
    const result = data?.[i]?.result as [bigint, bigint] | undefined;
    return {
      symbol: token.symbol,
      address: token.address,
      priceUSD: result ? Number(result[0]) / 1e18 : null,
      updatedAt: result ? Number(result[1]) : null,
    };
  });

  return { prices, isLoading };
}
```

---

## 3.7 Hook: Riwayat Aktivitas Agent

```ts
// hooks/useActivityLog.ts
import { useReadContract } from "wagmi";
import { AgentActivityLogAbi } from "@/lib/abis/AgentActivityLogAbi";
import { ADDRESSES } from "@/lib/addresses";

export function useVaultActivity(vaultAddress: `0x${string}`, count = 10n) {
  const { data, isLoading } = useReadContract({
    address: ADDRESSES.ACTIVITY_LOG,
    abi: AgentActivityLogAbi,
    functionName: "getActivitiesByVault",
    args: [vaultAddress, count],
    query: { enabled: !!vaultAddress },
  });

  const activities = (data ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    timestamp: new Date(Number(a.timestamp) * 1000),
    blockNumber: a.blockNumber,
  }));

  return { activities, isLoading };
}
```

---

## 3.8 Hook: Withdraw

```ts
// hooks/useWithdraw.ts
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

const USDC_DECIMALS = 6;

export function useWithdraw(vaultAddress: `0x${string}`, userAddress: `0x${string}`) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Withdraw sejumlah USDC tertentu
  const withdraw = (amountUSDC: string) => {
    const amount = parseUnits(amountUSDC, USDC_DECIMALS);
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "withdraw",
      args: [amount, userAddress, userAddress],
    });
  };

  // Redeem semua shares (full exit)
  const redeemAll = (shares: bigint) => {
    writeContract({
      address: vaultAddress,
      abi: UserVaultAbi,
      functionName: "redeem",
      args: [shares, userAddress, userAddress],
    });
  };

  return { withdraw, redeemAll, isPending, isConfirming, isSuccess };
}
```

---

## 3.9 Catatan Penting untuk FE

### USDC decimals = 6

```ts
// Semua amount USDC di contract pakai 6 desimal
const amount = parseUnits("100", 6);   // 100 USDC
const display = formatUnits(amount, 6); // "100.0"
```

### Harga dari PriceFeed = 1e18

```ts
// Semua harga dari PriceFeed pakai 18 desimal
const priceUSD = Number(rawPrice) / 1e18;  // mis. 308.90 untuk AAPL
```

### getPrice vs getPriceUnsafe

- `getPrice` — revert jika harga stale (> 2 jam tidak di-update) → pakai untuk validasi
- `getPriceUnsafe` — selalu return, meski stale, timestamp ikut dikembalikan → pakai untuk display

### User hanya punya satu vault

Satu wallet address = satu UserVault proxy. `deployVault()` revert kalau sudah punya. Selalu cek `vaultOf(address)` dulu.

### Withdraw tidak bisa di-pause

Deposit bisa di-pause oleh agent/owner (emergency), tapi `withdraw` dan `redeem` **tidak bisa di-block** — user selalu bisa ambil dana mereka.

---

## 3.10 Hook: USDC Balance User (untuk form deposit)

```ts
// hooks/useUSDCBalance.ts
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";

const USDC_ADDRESS = "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD" as const;

export function useUSDCBalance(userAddress: `0x${string}` | undefined) {
  const { data: raw, isLoading, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: [userAddress!],
    query: { enabled: !!userAddress, refetchInterval: 10_000 },
  });

  const balance = raw ? formatUnits(raw, 6) : "0";
  const balanceRaw = raw ?? 0n;

  return { balance, balanceRaw, isLoading, refetch };
}
```

---

## 3.11 Hook: Token Holdings Vault (breakdown portofolio per token)

Vault menyimpan berbagai token RWA. Hook ini baca balance setiap token yang ada di vault beserta nilai USD-nya.

```ts
// hooks/useVaultHoldings.ts
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { PriceFeedAbi } from "@/lib/abis/PriceFeedAbi";
import { ADDRESSES } from "@/lib/addresses";

// Semua token yang bisa ada di vault (sesuai allowedTokens di kontrak)
export const VAULT_TOKENS = [
  { symbol: "USDC",   address: "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD", decimals: 6  },
  { symbol: "mUSD",   address: "0xADA0466303441102cb16F8eC1594C744d603f746", decimals: 18 },
  { symbol: "USDY",   address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8", decimals: 18 },
  { symbol: "mETH",   address: "0xD89395Df78aaFdF86b330899d1C6189211e88750", decimals: 18 },
  { symbol: "cmETH",  address: "0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF", decimals: 18 },
  { symbol: "sUSDe",  address: "0xF76DA0ec605CFac82f1DA86080da21316C07d130", decimals: 18 },
  { symbol: "WMNT",   address: "0x61a4ac2678048ED431E362c14D2eC7A0B3191966", decimals: 18 },
  { symbol: "XAU",    address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1", decimals: 18 },
  { symbol: "AAPL",   address: "0xc2226548fb4332dce1e31dc317bcf61effd51375", decimals: 18 },
  { symbol: "MSFT",   address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63", decimals: 18 },
  { symbol: "NVDA",   address: "0x6ceaf0d037e628d8c08e1462f628bde4da633813", decimals: 18 },
  { symbol: "TSLA",   address: "0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523", decimals: 18 },
  { symbol: "BUIDL",  address: "0x92cf957248c8a695da67d91835bd02e6371e5bfd", decimals: 18 },
  { symbol: "ONDO",   address: "0x4e3a788cd351f73d70c85f640758d90d7c573a4d", decimals: 18 },
] as const;

type VaultToken = (typeof VAULT_TOKENS)[number];

export function useVaultHoldings(vaultAddress: `0x${string}` | undefined) {
  // Baca semua balance sekaligus
  const { data: balances, isLoading: loadingBalances } = useReadContracts({
    contracts: VAULT_TOKENS.map((t) => ({
      address: t.address as `0x${string}`,
      abi: ERC20Abi,
      functionName: "balanceOf" as const,
      args: [vaultAddress!] as [`0x${string}`],
    })),
    query: { enabled: !!vaultAddress, refetchInterval: 15_000 },
  });

  // Baca semua harga sekaligus (getPriceUnsafe agar tidak revert)
  const { data: prices, isLoading: loadingPrices } = useReadContracts({
    contracts: VAULT_TOKENS.map((t) => ({
      address: ADDRESSES.PRICE_FEED as `0x${string}`,
      abi: PriceFeedAbi,
      functionName: "getPriceUnsafe" as const,
      args: [t.address as `0x${string}`] as [`0x${string}`],
    })),
    query: { enabled: !!vaultAddress },
  });

  const holdings = VAULT_TOKENS.map((token: VaultToken, i) => {
    const rawBalance = (balances?.[i]?.result as bigint | undefined) ?? 0n;
    const priceResult = prices?.[i]?.result as [bigint, bigint] | undefined;
    const priceUSD = priceResult ? Number(priceResult[0]) / 1e18 : null;

    const balanceHuman = Number(formatUnits(rawBalance, token.decimals));
    const valueUSD = priceUSD !== null ? balanceHuman * priceUSD : null;

    return {
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      balance: rawBalance,
      balanceHuman,
      priceUSD,
      valueUSD,
    };
  }).filter((h) => h.balance > 0n); // hanya tampilkan yang ada balance-nya

  const totalValueUSD = holdings.reduce((sum, h) => sum + (h.valueUSD ?? 0), 0);

  return {
    holdings,
    totalValueUSD,
    isLoading: loadingBalances || loadingPrices,
  };
}
```

---

## 3.12 Error Handling — Semua Custom Error

Semua custom error dari kontrak perlu di-catch dan ditampilkan dengan pesan yang user-friendly.

```ts
// lib/errors.ts
import { ContractFunctionExecutionError, BaseError } from "viem";

export type TendsError =
  | "VaultAlreadyExists"
  | "VaultPaused"
  | "ZeroAmount"
  | "InvalidAllocationSum"
  | "NotAuthorizedAgent"
  | "RebalanceTooSoon"
  | "TokenNotAllowed"
  | "NoFeedConfigured"
  | "StalePrice"
  | "unknown";

export function parseTendsError(err: unknown): { type: TendsError; message: string } {
  if (err instanceof BaseError) {
    const cause = err.walk((e) => e instanceof ContractFunctionExecutionError);
    if (cause instanceof ContractFunctionExecutionError) {
      const name = cause.cause?.name ?? "";

      const map: Record<string, string> = {
        VaultAlreadyExists:    "Kamu sudah punya vault. Tidak bisa deploy dua kali.",
        VaultPaused:           "Vault sedang di-pause oleh agent. Deposit tidak bisa dilakukan, tapi withdraw tetap bisa.",
        ZeroAmount:            "Jumlah tidak boleh 0.",
        InvalidAllocationSum:  "Total alokasi custom harus pas 100% (10000 bps).",
        NotAuthorizedAgent:    "Hanya agent Hermes yang bisa melakukan rebalance.",
        RebalanceTooSoon:      "Rebalance baru saja dilakukan. Tunggu minimal 1 jam.",
        TokenNotAllowed:       "Token ini tidak diizinkan untuk swap di vault.",
        NoFeedConfigured:      "Harga token ini belum dikonfigurasi di PriceFeed.",
        StalePrice:            "Harga token sudah kadaluarsa (tidak di-update lebih dari 2 jam).",
      };

      if (name in map) {
        return { type: name as TendsError, message: map[name] };
      }
    }
  }

  return { type: "unknown", message: "Terjadi kesalahan. Coba lagi." };
}
```

Pemakaian di komponen:

```tsx
import { parseTendsError } from "@/lib/errors";

const { writeContract } = useWriteContract({
  mutation: {
    onError: (err) => {
      const { message } = parseTendsError(err);
      toast.error(message); // pakai sonner, react-hot-toast, dll
    },
  },
});
```

---

## 3.13 Event Watching — Real-time Rebalance Notification

```ts
// hooks/useRebalanceWatch.ts
import { useWatchContractEvent } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

export function useRebalanceWatch(
  vaultAddress: `0x${string}` | undefined,
  onRebalance: (timestamp: bigint, agent: `0x${string}`) => void
) {
  useWatchContractEvent({
    address: vaultAddress,
    abi: UserVaultAbi,
    eventName: "Rebalanced",
    enabled: !!vaultAddress,
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.timestamp && log.args.agent) {
          onRebalance(log.args.timestamp, log.args.agent);
        }
      }
    },
  });
}
```

Event watching untuk VaultFactory (deteksi vault baru deployed):

```ts
// hooks/useVaultDeployedWatch.ts
import { useWatchContractEvent } from "wagmi";
import { VaultFactoryAbi } from "@/lib/abis/VaultFactoryAbi";
import { ADDRESSES } from "@/lib/addresses";

export function useVaultDeployedWatch(
  onDeployed: (user: `0x${string}`, vault: `0x${string}`) => void
) {
  useWatchContractEvent({
    address: ADDRESSES.VAULT_FACTORY,
    abi: VaultFactoryAbi,
    eventName: "VaultDeployed",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.user && log.args.vault) {
          onDeployed(log.args.user, log.args.vault);
        }
      }
    },
  });
}
```

---

## 3.14 Contoh Komponen: Onboarding (Deploy Vault)

```tsx
// components/OnboardingCard.tsx
"use client";

import { useUserVault } from "@/hooks/useUserVault";
import { useWallets } from "@privy-io/react-auth";
import { parseTendsError } from "@/lib/errors";

export function OnboardingCard() {
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}` | undefined;
  const { hasVault, deployVault, isPending, isDeploying, deployed, refetch } = useUserVault();

  // Refetch setelah vault terdeploy
  if (deployed) refetch();

  if (!address) return <p>Connect wallet dulu.</p>;
  if (hasVault) return null; // sudah punya vault, skip onboarding

  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-xl font-semibold">Buat Vault Kamu</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Vault adalah tempat dana kamu dikelola oleh AI agent Hermes. Satu kali setup, selamanya.
      </p>
      <button
        className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-white disabled:opacity-50"
        onClick={deployVault}
        disabled={isPending || isDeploying}
      >
        {isPending ? "Konfirmasi di wallet..." : isDeploying ? "Deploying..." : "Buat Vault"}
      </button>
    </div>
  );
}
```

---

## 3.15 Contoh Komponen: Deposit Form

```tsx
// components/DepositForm.tsx
"use client";

import { useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useDepositWithPermit } from "@/hooks/useDepositWithPermit";
import { parseTendsError } from "@/lib/errors";

interface Props {
  vaultAddress: `0x${string}`;
}

export function DepositForm({ vaultAddress }: Props) {
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}`;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const { balance, balanceRaw } = useUSDCBalance(address);
  const { depositWithPermit, isPending } = useDepositWithPermit(vaultAddress, address);

  const handleDeposit = async () => {
    setError("");
    if (!amount || Number(amount) <= 0) {
      setError("Masukkan jumlah yang valid.");
      return;
    }
    try {
      await depositWithPermit(amount);
    } catch (err) {
      const { message } = parseTendsError(err);
      setError(message);
    }
  };

  const setMax = () => setAmount(balance);

  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-lg font-semibold">Deposit USDC</h2>
      <p className="mt-1 text-sm text-muted-foreground">Balance: {balance} USDC</p>

      <div className="mt-4 flex gap-2">
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2"
        />
        <button onClick={setMax} className="rounded-lg border px-3 py-2 text-sm">
          Max
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <button
        onClick={handleDeposit}
        disabled={isPending || !amount}
        className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Menunggu konfirmasi..." : "Deposit"}
      </button>

      <p className="mt-2 text-xs text-muted-foreground">
        Menggunakan EIP-2612 permit — hanya 1 transaksi, tidak perlu approve terpisah.
      </p>
    </div>
  );
}
```

---

## 3.16 Contoh Komponen: Dashboard Portfolio

```tsx
// components/PortfolioDashboard.tsx
"use client";

import { usePortfolio } from "@/hooks/usePortfolio";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { useVaultActivity } from "@/hooks/useActivityLog";
import { useWallets } from "@privy-io/react-auth";

const RISK_LABELS: Record<number, string> = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
  3: "CUSTOM",
};

interface Props {
  vaultAddress: `0x${string}`;
}

export function PortfolioDashboard({ vaultAddress }: Props) {
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}`;

  const { totalAssetsUSDC, riskPreference, lastRebalanceTime, paused, isLoading } =
    usePortfolio(vaultAddress, address);

  const { holdings, totalValueUSD } = useVaultHoldings(vaultAddress);
  const { activities } = useVaultActivity(vaultAddress, 5n);

  if (isLoading) return <p>Loading...</p>;

  const lastRebalance = lastRebalanceTime
    ? new Date(Number(lastRebalanceTime) * 1000).toLocaleString("id-ID")
    : "Belum pernah";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Total Portfolio</p>
        <p className="mt-1 text-3xl font-bold">${totalAssetsUSDC.toFixed(2)}</p>
        <div className="mt-3 flex gap-4 text-sm">
          <span>Strategi: <strong>{RISK_LABELS[Number(riskPreference)] ?? "-"}</strong></span>
          <span>Rebalance terakhir: <strong>{lastRebalance}</strong></span>
          {paused && <span className="text-yellow-500">⚠ Vault di-pause</span>}
        </div>
      </div>

      {/* Holdings */}
      <div className="rounded-xl border p-6">
        <h3 className="font-semibold">Komposisi Portofolio</h3>
        <div className="mt-4 space-y-3">
          {holdings.map((h) => (
            <div key={h.address} className="flex items-center justify-between">
              <span className="font-medium">{h.symbol}</span>
              <div className="text-right">
                <p className="text-sm">{h.balanceHuman.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">
                  {h.valueUSD !== null ? `$${h.valueUSD.toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
          ))}
          {holdings.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada token di vault.</p>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-xl border p-6">
        <h3 className="font-semibold">Riwayat Agent</h3>
        <div className="mt-4 space-y-2">
          {activities.map((a) => (
            <div key={String(a.id)} className="flex justify-between text-sm">
              <span>{a.action}</span>
              <span className="text-muted-foreground">
                {a.timestamp.toLocaleString("id-ID")}
              </span>
            </div>
          ))}
          {activities.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 3.17 Contoh Komponen: Risk Selector

```tsx
// components/RiskSelector.tsx
"use client";

import { useRiskLevel, RiskLevel } from "@/hooks/useRiskLevel";
import { parseTendsError } from "@/lib/errors";
import { useState } from "react";

const OPTIONS = [
  {
    level: RiskLevel.LOW,
    label: "LOW",
    desc: "Bonds & stablecoin yield. Volatilitas rendah.",
    color: "border-green-500 bg-green-50",
  },
  {
    level: RiskLevel.MEDIUM,
    label: "MEDIUM",
    desc: "Campuran bonds, commodities, dan funds.",
    color: "border-yellow-500 bg-yellow-50",
  },
  {
    level: RiskLevel.HIGH,
    label: "HIGH",
    desc: "Stocks & commodities. Potensi return tinggi.",
    color: "border-red-500 bg-red-50",
  },
];

interface Props {
  vaultAddress: `0x${string}`;
}

export function RiskSelector({ vaultAddress }: Props) {
  const { currentLevel, setRiskLevel, isPending } = useRiskLevel(vaultAddress);
  const [error, setError] = useState("");

  const handleSelect = (level: RiskLevel) => {
    setError("");
    try {
      setRiskLevel(level);
    } catch (err) {
      setError(parseTendsError(err).message);
    }
  };

  return (
    <div className="rounded-xl border p-6">
      <h3 className="font-semibold">Pilih Strategi Investasi</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Agent Hermes akan merebalance vault sesuai strategi yang kamu pilih.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.level}
            onClick={() => handleSelect(opt.level)}
            disabled={isPending}
            className={`rounded-lg border-2 p-4 text-left transition-all ${
              Number(currentLevel) === opt.level ? opt.color : "border-border"
            }`}
          >
            <p className="font-semibold">{opt.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {isPending && <p className="mt-3 text-sm text-muted-foreground">Menyimpan preferensi...</p>}
    </div>
  );
}
```

---

## 3.19 `lib/tokens.ts` — Katalog Token Lengkap per Kategori

Dipakai untuk render halaman marketplace, asset selector, dan filter kategori.

```ts
// lib/tokens.ts

export type TokenCategory =
  | "core"
  | "bonds"
  | "commodities"
  | "funds"
  | "fx"
  | "indices"
  | "stocks";

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  category: TokenCategory;
}

export const TOKENS: Token[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { symbol: "USDC",      name: "USD Coin",             address: "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD", decimals: 6,  category: "core" },
  { symbol: "mUSD",      name: "Mantle USD",            address: "0xADA0466303441102cb16F8eC1594C744d603f746", decimals: 18, category: "core" },
  { symbol: "USDY",      name: "Ondo USDY",             address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8", decimals: 18, category: "core" },
  { symbol: "mETH",      name: "Mantle ETH",            address: "0xD89395Df78aaFdF86b330899d1C6189211e88750", decimals: 18, category: "core" },
  { symbol: "cmETH",     name: "Compound mETH",         address: "0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF", decimals: 18, category: "core" },
  { symbol: "sUSDe",     name: "Staked USDe",           address: "0xF76DA0ec605CFac82f1DA86080da21316C07d130", decimals: 18, category: "core" },
  { symbol: "WMNT",      name: "Wrapped MNT",           address: "0x61a4ac2678048ED431E362c14D2eC7A0B3191966", decimals: 18, category: "core" },

  // ── Bonds ─────────────────────────────────────────────────────────────────
  { symbol: "CETES",     name: "Mexican T-Bills",       address: "0x1054424a70dae9098babec332e18a0f07d37d251", decimals: 18, category: "bonds" },
  { symbol: "GILTS",     name: "UK Gilts",              address: "0xbea967ace62d23d335ddad03972659509e1c3559", decimals: 18, category: "bonds" },
  { symbol: "KTB",       name: "Korean T-Bonds",        address: "0x10d9eb91d0a69098431fb833e666bd64455d45f3", decimals: 18, category: "bonds" },
  { symbol: "TESOURO",   name: "Brazilian Tesouro",     address: "0xfda1e869846776e3c182f5e105640ac48d474605", decimals: 18, category: "bonds" },

  // ── Commodities ───────────────────────────────────────────────────────────
  { symbol: "URANIUM",   name: "Uranium",               address: "0x1d7939e37e08802a6b86204f8e3c52ba4a6cbfba", decimals: 18, category: "commodities" },
  { symbol: "WTI",       name: "WTI Crude Oil",         address: "0x932e82632e80b06318ca969e33f99a54f1a04b10", decimals: 18, category: "commodities" },
  { symbol: "XAG",       name: "Silver",                address: "0xf380e8b6803ad065ef0567dd20c894a55050737c", decimals: 18, category: "commodities" },
  { symbol: "XAU",       name: "Gold",                  address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1", decimals: 18, category: "commodities" },
  { symbol: "XAUt",      name: "Tokenized Gold",        address: "0x0aa42416baccdb2fd4768b61111deb7f7d212f9b", decimals: 18, category: "commodities" },
  { symbol: "XCU",       name: "Copper",                address: "0xb3e1f06ac529aded2aa20aa38f4c0b4ad317e5f5", decimals: 18, category: "commodities" },
  { symbol: "XPT",       name: "Platinum",              address: "0x62e518611d5a135a50c18e5fcf3a333d6d3a0506", decimals: 18, category: "commodities" },

  // ── Funds ─────────────────────────────────────────────────────────────────
  { symbol: "ACRED",     name: "Arca Credit",           address: "0x3d85b13c76fc218830e3c0d2e147d1a6b8f3cdc8", decimals: 18, category: "funds" },
  { symbol: "BENJI",     name: "Franklin Templeton",    address: "0x56514dcf6e038ba1f77530cb9df01b2f9427ea11", decimals: 18, category: "funds" },
  { symbol: "BUIDL",     name: "BlackRock BUIDL",       address: "0x92cf957248c8a695da67d91835bd02e6371e5bfd", decimals: 18, category: "funds" },
  { symbol: "ONDO",      name: "Ondo Finance",          address: "0x4e3a788cd351f73d70c85f640758d90d7c573a4d", decimals: 18, category: "funds" },
  { symbol: "VBILL",     name: "Vault Bill",            address: "0xbc58f30dfaae433f5531a037365c06b98960e54a", decimals: 18, category: "funds" },

  // ── FX ────────────────────────────────────────────────────────────────────
  { symbol: "BRL",       name: "Brazilian Real",        address: "0xd568d045d34dca3f4f24be8099a8b90779047b6a", decimals: 18, category: "fx" },
  { symbol: "EUR",       name: "Euro",                  address: "0x781dfd2a2e6b2fb23e10a4b36691520e4bc36e2a", decimals: 18, category: "fx" },
  { symbol: "GBP",       name: "British Pound",         address: "0x2cbc4431d40121faa5b5a6d15240285761128f5a", decimals: 18, category: "fx" },
  { symbol: "IDR",       name: "Indonesian Rupiah",     address: "0x37e11a01f58f973098bef434a34e7fc3be4e3041", decimals: 18, category: "fx" },
  { symbol: "JPY",       name: "Japanese Yen",          address: "0x718c268093b11bea78a9b84861b2e4e96e86c33b", decimals: 18, category: "fx" },
  { symbol: "KRW",       name: "Korean Won",            address: "0x42feae1f60b23feb1f5c501977af161116fe3e99", decimals: 18, category: "fx" },
  { symbol: "SGD",       name: "Singapore Dollar",      address: "0x039263c8b98f62f7e2debcd277ef3f1f2baf9dce", decimals: 18, category: "fx" },
  { symbol: "TRY",       name: "Turkish Lira",          address: "0x58061565f6f2b5c8322ee3fa2dcd6497d72e5b20", decimals: 18, category: "fx" },

  // ── Indices ───────────────────────────────────────────────────────────────
  { symbol: "KOSPI200",  name: "KOSPI 200",             address: "0xc43bd39225a38ce33751c55c74741834a8e82d16", decimals: 18, category: "indices" },
  { symbol: "NIKKEI225", name: "Nikkei 225",            address: "0x6289654b4197744800d761a4641ba0c4a79f5ed1", decimals: 18, category: "indices" },
  { symbol: "USA100",    name: "Nasdaq 100",            address: "0x7bb9e063dab0b53fb7b7b438548d5a8c62e3afb7", decimals: 18, category: "indices" },
  { symbol: "USA500",    name: "S&P 500",               address: "0x6956dbbeb8eca1160ae21d2d703cdf6b86525825", decimals: 18, category: "indices" },

  // ── Stocks ────────────────────────────────────────────────────────────────
  { symbol: "AAPL",      name: "Apple",                 address: "0xc2226548fb4332dce1e31dc317bcf61effd51375", decimals: 18, category: "stocks" },
  { symbol: "AMZN",      name: "Amazon",                address: "0x5dbc3c81dbbb39dd865ec27c66abb48150325df1", decimals: 18, category: "stocks" },
  { symbol: "GOOGL",     name: "Alphabet",              address: "0xdd63da0a5ec0a76029dd49c32de7de73d8918e96", decimals: 18, category: "stocks" },
  { symbol: "META",      name: "Meta",                  address: "0x028ffc7b83ac3ec143bed5a8f14c7e49a356c793", decimals: 18, category: "stocks" },
  { symbol: "MSFT",      name: "Microsoft",             address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63", decimals: 18, category: "stocks" },
  { symbol: "NVDA",      name: "NVIDIA",                address: "0x6ceaf0d037e628d8c08e1462f628bde4da633813", decimals: 18, category: "stocks" },
  { symbol: "PLTR",      name: "Palantir",              address: "0x56979c925faa2b84637f2991c31fd6b1b33624b0", decimals: 18, category: "stocks" },
  { symbol: "TSLA",      name: "Tesla",                 address: "0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523", decimals: 18, category: "stocks" },
];

// Helper: cari token by address (case-insensitive)
export function getTokenByAddress(address: string): Token | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

// Helper: filter by kategori
export function getTokensByCategory(category: TokenCategory): Token[] {
  return TOKENS.filter((t) => t.category === category);
}

// Helper: address → symbol (untuk label cepat di UI)
export const TOKEN_SYMBOL_MAP = Object.fromEntries(
  TOKENS.map((t) => [t.address.toLowerCase(), t.symbol])
) as Record<string, string>;
```

---

## 3.20 Hook: Baca `allowedTokens` Dinamis dari Vault

Jangan hardcode daftar token di vault — baca langsung dari kontrak agar selalu sinkron kalau owner update.

```ts
// hooks/useAllowedTokens.ts
import { useReadContract } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";
import { getTokenByAddress } from "@/lib/tokens";
import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";

export function useAllowedTokens(vaultAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient();
  const [tokens, setTokens] = useState<ReturnType<typeof getTokenByAddress>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!vaultAddress || !publicClient) return;

    const fetchTokens = async () => {
      setIsLoading(true);
      const result: ReturnType<typeof getTokenByAddress>[] = [];
      let i = 0;

      // Baca array satu per satu sampai revert (end of array)
      while (true) {
        try {
          const addr = await publicClient.readContract({
            address: vaultAddress,
            abi: UserVaultAbi,
            functionName: "allowedTokens",
            args: [BigInt(i)],
          });
          result.push(getTokenByAddress(addr));
          i++;
        } catch {
          break; // array habis
        }
      }

      setTokens(result.filter(Boolean));
      setIsLoading(false);
    };

    fetchTokens();
  }, [vaultAddress, publicClient]);

  return { tokens, isLoading };
}
```

> **Catatan:** Vault saat ini sudah dikonfigurasi dengan semua mock token yang ada. List ini tidak akan sering berubah, jadi aman di-cache di state.

---

## 3.21 Handling Harga Null (Token Belum Ada di MockOracle)

Beberapa token (misal GOOGL) belum di-push harganya oleh backend relayer ke MockOracle. `getPriceUnsafe` untuk token ini akan return `(0n, 0n)` — **bukan revert**.

Tandai token sebagai "harga tidak tersedia" dan jangan tampilkan nilai USD-nya.

```ts
// lib/price.ts

export type PriceStatus = "available" | "unavailable" | "stale";

const MAX_STALENESS_SECONDS = 2 * 60 * 60; // 2 jam (sama dengan kontrak)

export interface PriceResult {
  priceUSD: number | null;
  updatedAt: Date | null;
  status: PriceStatus;
}

export function parsePriceResult(
  raw: [bigint, bigint] | undefined
): PriceResult {
  if (!raw || raw[0] === 0n) {
    return { priceUSD: null, updatedAt: null, status: "unavailable" };
  }

  const priceUSD = Number(raw[0]) / 1e18;
  const updatedAt = new Date(Number(raw[1]) * 1000);
  const elapsedSeconds = (Date.now() / 1000) - Number(raw[1]);

  const status: PriceStatus =
    elapsedSeconds > MAX_STALENESS_SECONDS ? "stale" : "available";

  return { priceUSD, updatedAt, status };
}
```

Pakai di komponen:

```tsx
import { parsePriceResult } from "@/lib/price";

// hasil dari useReadContracts getPriceUnsafe
const { priceUSD, status } = parsePriceResult(rawResult);

// Render
{status === "available" && <span>${priceUSD!.toFixed(2)}</span>}
{status === "unavailable" && <span className="text-muted-foreground">Harga belum tersedia</span>}
{status === "stale" && <span className="text-yellow-500">Data lama</span>}
```

Update `useVaultHoldings` (3.11) untuk pakai `parsePriceResult`:

```ts
// Di dalam useVaultHoldings.ts, ganti bagian map:
import { parsePriceResult } from "@/lib/price";

const holdings = allowedTokens.map((token, i) => {
  const rawBalance = (balances?.[i]?.result as bigint | undefined) ?? 0n;
  const rawPrice = prices?.[i]?.result as [bigint, bigint] | undefined;
  const { priceUSD, status } = parsePriceResult(rawPrice);

  const balanceHuman = Number(formatUnits(rawBalance, token.decimals));
  const valueUSD = status === "available" && priceUSD !== null
    ? balanceHuman * priceUSD
    : null;

  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals,
    balance: rawBalance,
    balanceHuman,
    priceUSD,
    priceStatus: status,
    valueUSD,
  };
}).filter((h) => h.balance > 0n);
```

---

## 3.18 Checklist Sebelum Build

- [ ] `NEXT_PUBLIC_PRIVY_APP_ID` diisi di `.env.local`
- [ ] Buat semua file di `lib/abis/` (VaultFactory, UserVault, PriceFeed, AgentActivityLog, ERC20)
- [ ] `lib/addresses.ts` diisi sesuai tabel Part 1
- [ ] `lib/chains.ts` berisi config Mantle Sepolia (chainId 5003)
- [ ] Privy di-setup dengan `defaultChain: mantleSepolia`
- [ ] Semua hook pakai `query: { enabled: !!address }` agar tidak fire sebelum wallet connect
- [ ] USDC decimals = **6**, harga PriceFeed = **1e18** — jangan tertukar
- [ ] Selalu cek `vaultOf(address)` sebelum tampilkan UI deposit — kalau `0x000...` berarti belum punya vault
