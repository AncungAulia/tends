/**
 * Simulate withdraw(50%) dan withdraw(MAX) untuk vault tertentu.
 *
 * Usage:
 *   pnpm tsx scripts/simulate-withdraw.ts <vault_address>
 *
 * Checks:
 *   1. Baca semua holdings + USDC balance vault
 *   2. Apakah withdraw(50%) bisa langsung → butuh USDC cukup
 *   3. Apakah withdraw(MAX) bisa langsung
 *   4. Estimasi setelah agentLiquidate (jual semua non-USDC ke USDC dg slippage 1%)
 *   5. Apakah withdraw(50%) dan MAX bisa setelah liquidasi
 */

import { formatUnits } from "viem";
import { publicClient } from "../src/chain/index.js";
import { addresses, as0x } from "../src/chain/addresses.js";
import { TOKENS, PUSHABLE_TOKENS } from "../src/chain/tokens.js";
import {
  ERC20_ABI,
  USER_VAULT_ABI,
  PRICE_FEED_ABI,
} from "../src/chain/abis.js";

// ── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) + "%" : "—";

const MAX_SLIPPAGE_BPS = 100n; // vault default 1%

// ── main ───────────────────────────────────────────────────────────────────

const vaultArg = process.argv[2];
if (!vaultArg || !vaultArg.startsWith("0x")) {
  console.error("Usage: pnpm tsx scripts/simulate-withdraw.ts <vault_address>");
  process.exit(1);
}
const VAULT = as0x(vaultArg);

console.log("\n══════════════════════════════════════════════");
console.log(" WITHDRAW SIMULATION");
console.log(" Vault :", VAULT);
console.log("══════════════════════════════════════════════\n");

// ── 1. Read token balances + prices ───────────────────────────────────────

const allTokens = Object.values(TOKENS);

const balanceCalls = allTokens.map((t) => ({
  address: as0x(t.address),
  abi: ERC20_ABI,
  functionName: "balanceOf" as const,
  args: [VAULT] as [`0x${string}`],
}));

const priceCalls = allTokens.map((t) => ({
  address: as0x(addresses.priceFeed),
  abi: PRICE_FEED_ABI,
  functionName: "getPriceUnsafe" as const,
  args: [as0x(t.address)] as [`0x${string}`],
}));

const totalAssets = await publicClient.readContract({
  address: VAULT,
  abi: USER_VAULT_ABI,
  functionName: "totalAssets",
});

const [balResults, priceResults] = await Promise.all([
  publicClient.multicall({ contracts: balanceCalls }),
  publicClient.multicall({ contracts: priceCalls }),
]);

// ── 2. Build holdings table ────────────────────────────────────────────────

type Holding = {
  symbol: string;
  decimals: number;
  balance: bigint;
  balanceHuman: number;
  priceUSD: number;
  valueUSD: number;
  isUsdc: boolean;
};

const holdings: Holding[] = allTokens.map((t, i) => {
  const balance = (balResults[i].result as bigint | undefined) ?? 0n;
  const rawPrice = priceResults[i].result as readonly [bigint, bigint] | undefined;
  const isUsdc = t.symbol === "USDC";
  // USDC priced at $1 (oracle doesn't serve USDC)
  const priceUSD = isUsdc
    ? 1
    : rawPrice
    ? Number(formatUnits(rawPrice[0], 18))
    : 0;
  const balanceHuman = Number(formatUnits(balance, t.decimals));
  return {
    symbol: t.symbol,
    decimals: t.decimals,
    balance,
    balanceHuman,
    priceUSD,
    valueUSD: balanceHuman * priceUSD,
    isUsdc,
  };
}).filter((h) => h.balance > 0n || h.isUsdc);

const totalValueUSD = Number(formatUnits(totalAssets, 6)); // USDC-denominated
const usdcHolding = holdings.find((h) => h.isUsdc)!;
const usdcInVault = usdcHolding?.valueUSD ?? 0;
const nonUsdcHoldings = holdings.filter((h) => !h.isUsdc && h.valueUSD > 0);

// ── 3. Print holdings ──────────────────────────────────────────────────────

console.log("── VAULT HOLDINGS ────────────────────────────");
for (const h of holdings.filter((h) => h.valueUSD > 0 || h.isUsdc)) {
  const tag = h.isUsdc ? " (liquid)" : "";
  console.log(
    `  ${h.symbol.padEnd(8)} ${h.balanceHuman.toFixed(4).padStart(12)}  ~$${fmt(h.valueUSD).padStart(9)}${tag}`,
  );
}
console.log(`${"".padEnd(40, "─")}`);
console.log(`  ${"TOTAL".padEnd(8)} ${"".padStart(12)}   $${fmt(totalValueUSD)}`);
console.log(`  USDC available in vault: $${fmt(usdcInVault)} (${pct(usdcInVault, totalValueUSD)} of total)\n`);

// ── 4. Scenario helper ─────────────────────────────────────────────────────

function checkWithdraw(label: string, amount: number) {
  const canDirect = usdcInVault >= amount;
  const usdcShortfall = Math.max(0, amount - usdcInVault);

  // After agentLiquidate: sell all non-USDC at 1% slippage
  const liquidatedUSDC =
    usdcInVault +
    nonUsdcHoldings.reduce((sum, h) => sum + h.valueUSD * 0.99, 0);
  const canAfterLiquidate = liquidatedUSDC >= amount;

  console.log(`── SCENARIO: ${label} = $${fmt(amount)} ─────────────────────`);
  console.log(`  Requested        : $${fmt(amount)}`);
  console.log(`  USDC in vault    : $${fmt(usdcInVault)}`);
  console.log(
    `  Direct withdraw  : ${canDirect ? "✅ YES" : "❌ NO  (shortfall $" + fmt(usdcShortfall) + ")"}`,
  );
  if (!canDirect) {
    console.log(`\n  After agentLiquidate (est. 1% slippage):`);
    for (const h of nonUsdcHoldings) {
      const proceeds = h.valueUSD * 0.99;
      console.log(`    Sell ${h.symbol.padEnd(6)}: $${fmt(h.valueUSD)} → ~$${fmt(proceeds)} USDC`);
    }
    console.log(`    Total USDC after liquidation: ~$${fmt(liquidatedUSDC)}`);
    console.log(
      `  After liquidation: ${canAfterLiquidate ? "✅ YES" : "❌ NO  (still short $" + fmt(amount - liquidatedUSDC) + ")"}`,
    );
  }
  console.log();
}

// ── 5. Run scenarios ───────────────────────────────────────────────────────

checkWithdraw("50%", totalValueUSD * 0.5);
checkWithdraw("MAX (100%)", totalValueUSD);

// ── 6. Summary ─────────────────────────────────────────────────────────────

console.log("── SUMMARY ───────────────────────────────────");
const needsLiquidation = usdcInVault < totalValueUSD * 0.5;
if (needsLiquidation) {
  console.log("  ❌ Withdraw 50% & MAX will FAIL on the current contract.");
  console.log("     Vault has non-USDC holdings that must be sold first.\n");
  console.log("  Fix needed (in backend /prepare-withdraw):");
  console.log("    1. Agent calls agentLiquidate() → sell all non-USDC to USDC");
  console.log("    2. Wait for tx confirmation");
  console.log("    3. Return UserVault.withdraw(amount) tx for user to sign");
  console.log("\n  agentLiquidate() is already in UserVault.sol — needs:");
  console.log("    • Contract upgrade/redeploy (UUPS)");
  console.log("    • Backend /prepare-withdraw wiring to call it via agent wallet");
} else {
  console.log("  ✅ Vault has enough USDC — both scenarios would succeed directly.");
}
console.log();
