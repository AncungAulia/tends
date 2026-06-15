/**
 * One-time setup: push all non-USDC token addresses from the TOKENS registry
 * into every existing vault via VaultFactory.batchAddTokensToVaults().
 *
 * Run after deploying the new UserVault + VaultFactory implementations.
 *
 *   npx tsx src/scripts/setup-vault-tokens.ts
 */

import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";
import { TOKENS } from "../chain/tokens.js";
import { VAULT_FACTORY_ABI } from "../chain/abis.js";
import { addresses } from "../chain/addresses.js";
import { publicClient } from "../chain/index.js";
import { env } from "../config/env.js";
import { as0x } from "../chain/addresses.js";

async function main() {
  if (!env.PRIVATE_KEY_AGENT_EXECUTOR) throw new Error("PRIVATE_KEY_AGENT_EXECUTOR not set");
  const account = privateKeyToAccount(as0x(env.PRIVATE_KEY_AGENT_EXECUTOR));
  const wallet = createWalletClient({
    account,
    chain: mantleSepoliaTestnet,
    transport: http(env.MANTLE_RPC_URL),
  });

  // All tradeable token addresses (everything except USDC which is the vault asset)
  // Filter out empty addresses in case some env vars are not set locally
  const tokenAddresses = Object.values(TOKENS)
    .filter((t) => t.symbol !== "USDC" && t.address && t.address.length === 42)
    .map((t) => t.address as `0x${string}`);

  console.log(`Registering ${tokenAddresses.length} tokens into all vaults...`);
  console.log("Caller (agentExecutor):", account.address);
  console.log("VaultFactory:", addresses.vaultFactory);

  const totalVaults = await publicClient.readContract({
    address: addresses.vaultFactory as `0x${string}`,
    abi: VAULT_FACTORY_ABI,
    functionName: "totalVaults",
  });

  console.log(`Total vaults: ${totalVaults}`);

  const hash = await wallet.writeContract({
    address: addresses.vaultFactory as `0x${string}`,
    abi: VAULT_FACTORY_ABI,
    functionName: "batchAddTokensToVaults",
    args: [tokenAddresses],
  });

  console.log("Tx submitted:", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Confirmed in block:", receipt.blockNumber, "status:", receipt.status);
  console.log("Done — all vaults now have all tokens registered.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
