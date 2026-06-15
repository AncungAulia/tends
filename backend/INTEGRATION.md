# Backend Integration Guide — Tends Smart Contracts

Dokumen ini untuk backend developer yang perlu integrate dengan Tends smart contract di **Mantle Sepolia** (chainId 5003).

Backend punya **dua tanggung jawab utama**:
1. **Price Pusher** — push harga aset ke `PriceFeed` contract secara berkala
2. **AI Agent (Hermes)** — trigger `rebalance()` di setiap user vault berdasarkan risk preference mereka

Kedua peran ini butuh **private key `AGENT_EXECUTOR`** — minta dari smart contract dev (Axel).

---

## Arsitektur Smart Contract

### Gambaran sistem

```
User (wallet)
  │
  ├─ deposit USDC ──────────────────────────────────────┐
  │                                                      ▼
  └─ deployVault() ──→ VaultFactory ──→ UserVault (proxy ERC-4626)
                                              │
                              ┌───────────────┼────────────────┐
                              │               │                │
                              ▼               ▼                ▼
                          USDC balance   RWA token        PriceFeed
                          (di vault)     balances         (baca harga)
                                              │
                         Agent (Hermes) ──────┘
                              │
                              └─ rebalance() ──→ StrategyRouter ──→ MockDexAdapter
                                                                    (swap tokens)
```

### Penjelasan tiap contract

**`VaultFactory`** — Registry dan deployer vault per user.
- Setiap user punya **satu vault pribadi** (1 user = 1 vault).
- User call `deployVault()` untuk membuat vault mereka. Factory otomatis authorize vault baru ke StrategyRouter dan AgentActivityLog.
- Backend bisa query `totalVaults()` dan `allVaults(i)` untuk iterasi semua vault.

**`UserVault`** — ERC-4626 vault per user, UUPS upgradeable.
- Aset dasar = **USDC** (6 desimal). User deposit USDC, dapat shares.
- Vault pegang USDC + token RWA (mUSD, USDY, mETH, cmETH, sUSDe, WMNT).
- `totalAssets()` menghitung nilai semua token dalam USDC menggunakan harga dari PriceFeed.
- User set `riskPreference` (LOW/MEDIUM/HIGH/CUSTOM) — ini yang dibaca agent saat rebalance.
- **Withdraw tidak pernah dipaused** — user selalu bisa keluar.

**`PriceFeed`** — Harga semua token, 18 desimal, UUPS upgradeable.
- Backend push harga via `pushPrices()` — hanya wallet yang diauthorize yang bisa.
- Punya `maxStaleness = 2 jam` — lewat dari itu, vault tidak bisa rebalance (tapi withdraw tetap bisa).
- Ada dua fungsi read: `getPrice()` (revert kalau stale) dan `getPriceUnsafe()` (return walau stale).
- USDC dan mUSD pakai **static price** ($1.00) — tidak perlu di-push.

**`StrategyRouter`** — Intermediary antara vault dan DEX adapter.
- Vault call `executeSwap()` lewat router — vault tidak langsung sentuh DEX.
- Router whitelist token yang boleh di-swap. Hanya vault yang sudah diauthorize yang bisa call.
- Untuk testnet, router connect ke `MockDexAdapter`.

**`MockDexAdapter`** — Simulasi DEX untuk testnet.
- Baca harga dari PriceFeed untuk hitung exchange rate.
- Apply 0.3% mock slippage.
- Harus punya saldo token yang cukup untuk fulfill swap (di-seed saat deployment).
- **Di production nanti, adapter ini diganti dengan real DEX** (Merchant Moe, Agni, dll) tanpa ubah interface.

**`AgentActivityLog`** — Audit trail on-chain, UUPS upgradeable.
- Setiap `rebalance()` otomatis tulis log ke sini dari dalam vault.
- Backend juga bisa tulis log manual untuk event off-chain.
- Semua log public — bisa dibaca siapa saja.

### Flow lengkap: dari user deposit sampai agent rebalance

```
1. User buka app → call VaultFactory.deployVault()
   └─ Factory deploy UserVault proxy untuk user tersebut

2. User deposit USDC → call UserVault.deposit(amount, userAddress)
   └─ Vault mint ERC-4626 shares ke user
   └─ USDC masuk ke vault (belum di-swap)

3. User set risk preference → call UserVault.setRiskLevel(MEDIUM)
   └─ Tersimpan di vault, agent baca ini saat rebalance

4. Agent Hermes (backend) deteksi vault perlu rebalance:
   - Baca riskPreference dari vault
   - Hitung target allocation (contoh MEDIUM: 40% mUSD, 30% mETH, 30% cmETH)
   - Baca current saldo tiap token di vault
   - Hitung delta → generate SwapInstruction[]
   - Call vault.rebalance(instructions) dengan wallet AGENT_EXECUTOR

5. Di dalam rebalance():
   - Vault approve token ke StrategyRouter
   - StrategyRouter call MockDexAdapter.swap()
   - DEX transfer tokenIn dari router, transfer tokenOut ke vault
   - Vault log ke AgentActivityLog
   - lastRebalanceTime di-update (cooldown 1 jam)

6. User bisa withdraw kapanpun → call UserVault.withdraw(amount, receiver, owner)
   └─ Vault burn shares dan transfer USDC kembali ke user
   └─ Kalau vault pegang RWA, agent perlu sell dulu ke USDC sebelum user withdraw besar
```

### Token yang digunakan (semua mock di testnet)

| Symbol | Desimal | Harga | Keterangan |
|---|---|---|---|
| USDC | 6 | $1.00 (static) | Aset dasar vault, tidak di-push |
| mUSD | 18 | $1.00 (static) | Mantle USD |
| USDY | 18 | ~$1.05 | Ondo US Dollar Yield |
| mETH | 18 | ~$2000 | Mantle Staked Ether |
| cmETH | 18 | ~$2100 | Cumulative mETH |
| sUSDe | 18 | ~$1.08 | Staked USDe |
| WMNT | 18 | ~$0.50 | Wrapped Mantle |

> Backend hanya perlu push harga untuk 5 token terakhir (USDY, mETH, cmETH, sUSDe, WMNT). USDC dan mUSD sudah static di contract.

---

## Daftar Contract Address

> Isi dari `smart-contract/deployments/mantle-sepolia.json` setelah deployment.
> Semua null = belum deploy. Hubungi Axel untuk address terbaru.

| Contract | Address | Keterangan |
|---|---|---|
| `PriceFeed` | `null` (TBD) | Simpan harga semua aset, 18 desimal |
| `AgentActivityLog` | `null` (TBD) | Log semua aksi agent on-chain |
| `StrategyRouter` | `null` (TBD) | Routing swap antar token |
| `VaultFactory` | `null` (TBD) | Registry semua user vault |
| `MockOracle` | `0x26f9178b4082b68D8cC55874D377f9829Fc8C22d` | Sudah live di Mantle Sepolia |

---

## Setup

### Environment variables yang dibutuhkan

```env
# Wajib — private key wallet AGENT_EXECUTOR (minta dari Axel)
AGENT_EXECUTOR_PRIVATE_KEY=0x...

# Wajib — address dari deployment (isi setelah Axel deploy)
PRICE_FEED_ADDRESS=0x...
ACTIVITY_LOG_ADDRESS=0x...
VAULT_FACTORY_ADDRESS=0x...

# Network
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
CHAIN_ID=5003

# Opsional — address mock oracle untuk baca harga referensi
MOCK_ORACLE_ADDRESS=0x26f9178b4082b68D8cC55874D377f9829Fc8C22d
```

### Install dependency

```bash
npm install viem
# atau
pnpm add viem
```

---

## 1. Price Pusher

Backend perlu push harga ke `PriceFeed` contract setiap **~5 menit**. `PriceFeed` punya `maxStaleness = 2 jam` — kalau lebih dari itu, vault tidak bisa rebalance (tapi user masih bisa withdraw, itu by design).

### Interface PriceFeed

```ts
const PRICE_FEED_ABI = [
  {
    name: "pushPrices",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "prices", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "price", type: "uint256" }],
  },
  {
    name: "getPriceUnsafe",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    name: "maxStaleness",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
```

### Contoh: push harga batch

Harga dalam **18 desimal** — contoh: $2000 = `2000n * 10n**18n`.

```ts
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepoliaTestnet } from "viem/chains";

const account = privateKeyToAccount(process.env.AGENT_EXECUTOR_PRIVATE_KEY as `0x${string}`);

const walletClient = createWalletClient({
  account,
  chain: mantleSepoliaTestnet,
  transport: http(process.env.MANTLE_SEPOLIA_RPC),
});

// Token addresses (dari deployment)
const TOKEN_ADDRESSES = {
  USDY:  "0x...",  // isi dari mantle-sepolia.json
  mETH:  "0x...",
  cmETH: "0x...",
  sUSDe: "0x...",
  WMNT:  "0x...",
};

async function pushPrices(prices: Record<string, number>) {
  const tokens = Object.keys(prices).map((sym) => TOKEN_ADDRESSES[sym]);
  const priceValues = Object.values(prices).map((p) =>
    BigInt(Math.round(p * 1e18))
  );

  const hash = await walletClient.writeContract({
    address: process.env.PRICE_FEED_ADDRESS as `0x${string}`,
    abi: PRICE_FEED_ABI,
    functionName: "pushPrices",
    args: [tokens, priceValues],
  });

  console.log(`[PricePusher] pushed ${tokens.length} prices, tx: ${hash}`);
  return hash;
}

// Contoh panggil
await pushPrices({
  USDY:  1.05,
  mETH:  2000.0,
  cmETH: 2100.0,
  sUSDe: 1.08,
  WMNT:  0.50,
});
```

### Sumber harga

Baca dari `MockOracle` yang sudah live di Mantle Sepolia (`0x26f9178b4082b68D8cC55874D377f9829Fc8C22d`). Oracle ini di-relayer dari RedStone + Ondo. Detail di `smart-contract/INTEGRATION.md`.

```ts
const MOCK_ORACLE_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "updatedAt", type: "uint64" },
    ],
  },
] as const;

// Feed ID mapping (bytes32 dari string)
import { stringToHex } from "viem";

const FEED_IDS = {
  USDY:  stringToHex("USDY",             { size: 32 }),
  mETH:  stringToHex("mETH_FUNDAMENTAL", { size: 32 }),
  cmETH: stringToHex("cmETH",            { size: 32 }),
  sUSDe: stringToHex("sUSDe",            { size: 32 }),
  WMNT:  stringToHex("MNT",              { size: 32 }),
};

async function fetchFromMockOracle(symbol: string): Promise<bigint> {
  const [value] = await publicClient.readContract({
    address: "0x26f9178b4082b68D8cC55874D377f9829Fc8C22d",
    abi: MOCK_ORACLE_ABI,
    functionName: "getPrice",
    args: [FEED_IDS[symbol]],
  });
  return value; // sudah 18 desimal
}
```

---

## 2. AI Agent — Rebalance

Agent "Hermes" bertugas membaca risk preference tiap user vault dan trigger `rebalance()` dengan swap instruction yang sesuai.

### Alur kerja agent

```
1. Ambil semua vault address dari VaultFactory
2. Untuk tiap vault:
   a. Baca riskPreference (LOW / MEDIUM / HIGH / CUSTOM)
   b. Baca current allocation (saldo tiap token di vault)
   c. Hitung target allocation berdasarkan strategy
   d. Generate swap instructions (tokenIn, tokenOut, amount, minOut)
   e. Panggil vault.rebalance(instructions)
3. Log aktivitas ke AgentActivityLog
```

### Strategy allocation

| Risk Level | Allocation |
|---|---|
| LOW | 90% mUSD + 10% USDY |
| MEDIUM | 40% mUSD + 30% mETH + 30% cmETH |
| HIGH | 40% cmETH + 30% sUSDe + 20% mETH + 10% WMNT |
| CUSTOM | `customAllocation.lowBps / medBps / highBps` — proporsi antara LOW/MEDIUM/HIGH |

### Interface UserVault

```ts
const USER_VAULT_ABI = [
  // Baca state
  {
    name: "riskPreference",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }], // 0=LOW, 1=MEDIUM, 2=HIGH, 3=CUSTOM
  },
  {
    name: "customAllocation",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "lowBps",  type: "uint16" },
      { name: "medBps",  type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }], // total nilai vault dalam USDC (6 desimal)
  },
  {
    name: "lastRebalanceTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "minRebalanceInterval",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }], // default 3600 (1 jam)
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  // Execute rebalance
  {
    name: "rebalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "instructions",
        type: "tuple[]",
        components: [
          { name: "tokenIn",     type: "address" },
          { name: "tokenOut",    type: "address" },
          { name: "amountIn",    type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  // Events
  {
    name: "Rebalanced",
    type: "event",
    inputs: [
      { name: "timestamp",    type: "uint256", indexed: false },
      { name: "agent",        type: "address", indexed: true  },
      { name: "instructions", type: "tuple[]", indexed: false,
        components: [
          { name: "tokenIn",     type: "address" },
          { name: "tokenOut",    type: "address" },
          { name: "amountIn",    type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ]
      },
    ],
  },
] as const;
```

### Interface VaultFactory (ambil semua vault)

```ts
const VAULT_FACTORY_ABI = [
  {
    name: "vaultOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address" }], // address(0) = belum punya vault
  },
  {
    name: "allVaults",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "totalVaults",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "VaultDeployed",
    type: "event",
    inputs: [
      { name: "user",  type: "address", indexed: true  },
      { name: "vault", type: "address", indexed: true  },
    ],
  },
] as const;
```

### Contoh: loop semua vault dan rebalance

```ts
import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepoliaTestnet } from "viem/chains";

const RISK_LEVEL = { LOW: 0, MEDIUM: 1, HIGH: 2, CUSTOM: 3 };

// Allocation target per strategy (bps, total = 10000)
const STRATEGY = {
  LOW: [
    { token: "mUSD",  bps: 9000 },
    { token: "USDY",  bps: 1000 },
  ],
  MEDIUM: [
    { token: "mUSD",  bps: 4000 },
    { token: "mETH",  bps: 3000 },
    { token: "cmETH", bps: 3000 },
  ],
  HIGH: [
    { token: "cmETH", bps: 4000 },
    { token: "sUSDe", bps: 3000 },
    { token: "mETH",  bps: 2000 },
    { token: "WMNT",  bps: 1000 },
  ],
};

async function runRebalanceLoop() {
  const account = privateKeyToAccount(process.env.AGENT_EXECUTOR_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: mantleSepoliaTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: mantleSepoliaTestnet, transport: http() });

  // 1. Ambil semua vault
  const totalVaults = await publicClient.readContract({
    address: process.env.VAULT_FACTORY_ADDRESS as `0x${string}`,
    abi: VAULT_FACTORY_ABI,
    functionName: "totalVaults",
  });

  const vaultAddresses: string[] = [];
  for (let i = 0n; i < totalVaults; i++) {
    const addr = await publicClient.readContract({
      address: process.env.VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: VAULT_FACTORY_ABI,
      functionName: "allVaults",
      args: [i],
    });
    vaultAddresses.push(addr);
  }

  // 2. Process tiap vault
  for (const vaultAddr of vaultAddresses) {
    await processVault(vaultAddr, publicClient, walletClient);
  }
}

async function processVault(vaultAddr: string, publicClient: any, walletClient: any) {
  // Cek paused dan cooldown
  const [paused, lastRebalance, minInterval, riskLevel] = await Promise.all([
    publicClient.readContract({ address: vaultAddr, abi: USER_VAULT_ABI, functionName: "paused" }),
    publicClient.readContract({ address: vaultAddr, abi: USER_VAULT_ABI, functionName: "lastRebalanceTime" }),
    publicClient.readContract({ address: vaultAddr, abi: USER_VAULT_ABI, functionName: "minRebalanceInterval" }),
    publicClient.readContract({ address: vaultAddr, abi: USER_VAULT_ABI, functionName: "riskPreference" }),
  ]);

  if (paused) { console.log(`[${vaultAddr}] paused, skip`); return; }

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < lastRebalance + minInterval) {
    console.log(`[${vaultAddr}] cooldown belum habis, skip`);
    return;
  }

  // Hitung instructions (implementasi logic allocation agent di sini)
  const instructions = await buildSwapInstructions(vaultAddr, riskLevel, publicClient);
  if (instructions.length === 0) { console.log(`[${vaultAddr}] sudah balanced, skip`); return; }

  const hash = await walletClient.writeContract({
    address: vaultAddr,
    abi: USER_VAULT_ABI,
    functionName: "rebalance",
    args: [instructions],
  });

  console.log(`[${vaultAddr}] rebalanced, tx: ${hash}`);
}
```

> **Catatan**: Fungsi `buildSwapInstructions()` adalah bagian dari logic AI agent. Agent perlu baca saldo tiap token di vault (`IERC20.balanceOf(vaultAddr)`), bandingkan dengan target allocation, lalu generate swap instructions. Slippage tolerance default vault = 1% (`maxSlippageBps = 100`).

---

## 3. Activity Log

Setiap `rebalance()` secara otomatis sudah nulis log ke `AgentActivityLog` dari dalam kontrak. Tapi backend juga bisa nulis log manual (misal: keputusan agent off-chain, price update, error handling).

### Interface AgentActivityLog

```ts
const ACTIVITY_LOG_ABI = [
  {
    name: "logActivity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault",    type: "address" },
      { name: "action",   type: "string"  },
      { name: "metadata", type: "bytes"   },
    ],
    outputs: [],
  },
  {
    name: "getRecentActivities",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id",          type: "uint256" },
          { name: "agent",       type: "address" },
          { name: "vault",       type: "address" },
          { name: "action",      type: "string"  },
          { name: "metadata",    type: "bytes"   },
          { name: "timestamp",   type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "ActivityLogged",
    type: "event",
    inputs: [
      { name: "id",        type: "uint256", indexed: true  },
      { name: "vault",     type: "address", indexed: true  },
      { name: "agent",     type: "address", indexed: true  },
      { name: "action",    type: "string",  indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
```

### Contoh: tulis log manual

```ts
import { encodeAbiParameters, parseAbiParameters } from "viem";

await walletClient.writeContract({
  address: process.env.ACTIVITY_LOG_ADDRESS as `0x${string}`,
  abi: ACTIVITY_LOG_ABI,
  functionName: "logActivity",
  args: [
    vaultAddress,
    "PRICE_UPDATE",
    encodeAbiParameters(parseAbiParameters("uint256 price, string symbol"), [
      2000n * 10n**18n,
      "mETH",
    ]),
  ],
});
```

Action string yang dipakai kontrak: `"REBALANCE"`. Bebas define action lain buat backend events.

---

## 4. Listen ke Events

Daripada polling, lebih efisien listen events dari kontrak.

```ts
// Listen vault baru di-deploy
publicClient.watchContractEvent({
  address: process.env.VAULT_FACTORY_ADDRESS as `0x${string}`,
  abi: VAULT_FACTORY_ABI,
  eventName: "VaultDeployed",
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Vault baru: user=${log.args.user}, vault=${log.args.vault}`);
      // Tambahkan ke list vault yang di-monitor
    }
  },
});

// Listen rebalance selesai
publicClient.watchContractEvent({
  address: vaultAddress,
  abi: USER_VAULT_ABI,
  eventName: "Rebalanced",
  onLogs: (logs) => {
    for (const log of logs) {
      console.log(`Rebalanced at ${log.args.timestamp}, agent=${log.args.agent}`);
    }
  },
});
```

---

## 5. Error Handling

Contract akan revert dengan error custom berikut:

| Error | Contract | Kondisi |
|---|---|---|
| `NotAuthorizedAgent()` | UserVault | `msg.sender != agentExecutor` — pastikan pakai wallet yang benar |
| `VaultPaused()` | UserVault | Vault sedang paused, skip dulu |
| `RebalanceTooSoon()` | UserVault | Kurang dari 1 jam sejak rebalance terakhir |
| `TokenNotAllowed()` | UserVault | Token di-swap bukan dalam whitelist vault |
| `NotAuthorized()` | AgentActivityLog | Wallet tidak diauthorize sebagai logger |
| `StalePrice()` | PriceFeed | Harga belum di-push dalam 2 jam terakhir |

```ts
import { ContractFunctionRevertedError } from "viem";

try {
  await walletClient.writeContract({ ... });
} catch (err) {
  if (err instanceof ContractFunctionRevertedError) {
    const name = err.data?.errorName;
    if (name === "RebalanceTooSoon") {
      console.log("Cooldown belum habis, skip");
    } else if (name === "VaultPaused") {
      console.log("Vault paused");
    } else {
      console.error("Unexpected revert:", name, err.message);
    }
  }
}
```

---

## 6. Checklist sebelum mulai

- [ ] Minta `AGENT_EXECUTOR_PRIVATE_KEY` dari Axel (wallet yang sudah diauthorize di semua contract)
- [ ] Minta contract addresses dari `smart-contract/deployments/mantle-sepolia.json` setelah Axel deploy
- [ ] Pastikan wallet AGENT_EXECUTOR punya MNT untuk gas (faucet: https://faucet.sepolia.mantle.xyz)
- [ ] Test price push dulu ke PriceFeed sebelum coba rebalance
- [ ] Rebalance baru bisa jalan kalau ada user yang sudah deposit ke vaultnya

---

## 7. Referensi

- Smart contract source: `smart-contract/src/`
- Oracle integration: `smart-contract/INTEGRATION.md`
- Network: Mantle Sepolia, chainId 5003, RPC `https://rpc.sepolia.mantle.xyz`
- Explorer: https://explorer.sepolia.mantle.xyz
- MockOracle live: `0x26f9178b4082b68D8cC55874D377f9829Fc8C22d`
