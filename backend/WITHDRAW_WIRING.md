# Withdraw Wiring Guide — `agentLiquidate` + `withdraw`

## Background: Kenapa withdraw sekarang gagal

`UserVault.withdraw()` adalah ERC-4626 standard yang **hanya mentransfer USDC langsung** dari vault.
`totalAssets()` menghitung nilai semua holdings (mETH, mUSD, USDY, dll.) dalam USDC-equivalent via oracle,
tapi saldo USDC fisik di vault biasanya nol karena semua sudah di-invest.

Hasil simulasi vault `0xc6667F8…`:

```
Holdings  : mUSD $398 · mETH $445 · USDY $99  (USDC = $0)
withdraw(50%)  → ❌ revert — USDC shortfall $471
withdraw(MAX)  → ❌ revert — USDC shortfall $943
```

---

## Fix: `agentLiquidate()` sebelum withdraw

Fungsi di `UserVault.sol` — **sudah live** di impl `0xbb06C7F1a4f6C85472e5C83069Aad524AE210E50`:

```solidity
function agentLiquidate() external onlyAgent nonReentrant {
    // jual semua non-USDC holdings → USDC via StrategyRouter
    // tidak ada cooldown (beda dari rebalance)
    // TIDAK update lastRebalanceTime
}
```

Setelah `agentLiquidate()`, vault hanya punya USDC → `withdraw(amount)` bisa jalan.

---

## Step 1: Deploy kontrak baru ✅ SUDAH SELESAI

Upgrade sudah di-broadcast dan verified di Mantle Sepolia pada 2026-06-05.

```
New UserVaultImpl : 0xbb06C7F1a4f6C85472e5C83069Aad524AE210E50
Vault proxy (test): 0xc6667F8aCd202EF42a34C68dC858761C53A8eD72  ← sudah pakai impl baru
VaultFactory      : 0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400  ← impl updated
Mantlescan        : https://sepolia.mantlescan.xyz/address/0xbb06c7f1a4f6c85472e5c83069aad524ae210e50
```

`deployments/mantle-sepolia.json` sudah diupdate dengan address di atas.

---

## Step 2: Tambahkan ABI ke backend ✅ SUDAH SELESAI

Di `backend/src/chain/abis.ts`, tambahkan ke `USER_VAULT_ABI`:

```typescript
{
  // onlyAgent — called by backend before returning withdraw tx
  name: "agentLiquidate",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
},
```

Dan tambahkan ke `USER_VAULT_TX_ABI` juga (untuk encoding tx):

```typescript
{
  name: "agentLiquidate",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [],
  outputs: [],
},
```

---

## Step 3: Wire `/prepare-withdraw` di backend ✅ SUDAH SELESAI

Di `backend/src/api/routes/tx.ts`, handler `prepare-withdraw` sudah diganti:

```typescript
r.post("/prepare-withdraw", async (c) => {
  const p = await parseBody(c, withdrawBody);
  if (!p.ok) return p.res;
  const { vault, account, amount } = p.data;

  const vaultAddr = vault as `0x${string}`;
  const ownerAddr = account as `0x${string}`;

  // ── 1. Gas top-up ─────────────────────────────────────────
  await tryEnsureGas(ownerAddr);

  // ── 2. Agent liquidates all non-USDC holdings → USDC ─────
  const agent = getAgentWallet();
  const liquidateTxHash = await agent.writeContract({
    address: vaultAddr,
    abi: USER_VAULT_TX_ABI,
    functionName: "agentLiquidate",
    args: [],
    chain: activeChain,
    account: agent.account!,
  });
  await publicClient.waitForTransactionReceipt({ hash: liquidateTxHash });

  // ── 3. Baca USDC balance SETELAH liquidasi ────────────────
  // PENTING: pakai balance aktual, bukan totalAssets()
  // → menghindari gap slippage (totalAssets oracle ≠ actual USDC received)
  const usdcBalance = await publicClient.readContract({
    address: as0x(TOKENS.USDC.address),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [vaultAddr],
  }) as bigint;

  const usdcBalanceHuman = Number(usdcBalance) / 10 ** 6;

  // Clamp: jangan minta lebih dari yang tersedia (0.1% buffer untuk slippage)
  const safeAmount = Math.min(amount, usdcBalanceHuman * 0.999);

  // ── 4. Return withdraw tx untuk user sign ─────────────────
  return c.json({ tx: tx.prepareWithdraw(vaultAddr, ownerAddr, safeAmount) });
});
```

### Import yang ditambahkan di atas file `tx.ts`

```typescript
import { getAgentWallet, publicClient, activeChain } from "../../chain/index.js";
import { USER_VAULT_TX_ABI, ERC20_ABI } from "../../chain/abis.js";
import { TOKENS } from "../../chain/tokens.js";
import { as0x } from "../../chain/addresses.js";
```

---

## Step 4: Validasi response shape ✅ SUDAH SELESAI

Response dari `/prepare-withdraw` tetap sama — frontend tidak perlu berubah:

```json
{
  "tx": {
    "to": "0xVAULT_ADDRESS",
    "data": "0x...",
    "value": "0"
  }
}
```

---

## Kenapa MAX withdraw masih perlu hati-hati

`totalAssets()` menggunakan oracle price (tanpa slippage).
`agentLiquidate()` jual dengan slippage 1% (maxSlippageBps = 100).
Gap: vault senilai $943 → hanya dapat ~$934 USDC setelah liquidasi.

**Solusi:** Clamp `amount` ke `usdcBalance × 0.999` (step 3 di atas).
Frontend sudah menampilkan `Available: $XXX` dari `totalAssets` — ini sedikit overshoot.
Tidak masalah karena backend akan clamp otomatis.

---

## Simulasi hasil setelah fix

```
withdraw(50% = $471)  → ✅ agentLiquidate → ~$934 USDC → withdraw($471) OK
withdraw(MAX = $943)  → ✅ agentLiquidate → ~$934 USDC → clamp → withdraw($934) OK
```

Untuk validasi manual, gunakan:

```bash
cd backend/
node --import tsx scripts/simulate-withdraw.ts 0xc6667F8aCd202EF42a34C68dC858761C53A8eD72
```

---

## Catatan keamanan

- `agentLiquidate()` adalah `onlyAgent` — hanya wallet `agentExecutor` bisa call
- Tidak ada cooldown (beda dari `rebalance()` yang punya `minRebalanceInterval = 1 hour`)
- `lastRebalanceTime` tidak di-update → cooldown rebalance tidak terpengaruh
- Gas untuk `agentLiquidate` dibayar oleh agent wallet (backend), bukan user
