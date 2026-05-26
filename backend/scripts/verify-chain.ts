import { formatEther, formatUnits } from "viem";
import { publicClient, agentAddress } from "../src/chain/index.js";
import { addresses, as0x } from "../src/chain/addresses.js";
import { VAULT_FACTORY_ABI, PRICE_FEED_ABI } from "../src/chain/abis.js";
import { priceMonitorService } from "../src/services/price-monitor.js";
import { rebalancerService } from "../src/services/rebalancer.js";

const agent = agentAddress()!;
console.log("agent address :", agent);
const bal = await publicClient.getBalance({ address: agent });
console.log("agent MNT gas :", formatEther(bal), bal === 0n ? "  ⚠️ NEEDS FAUCET" : "");

const total = await publicClient.readContract({
  address: as0x(addresses.vaultFactory),
  abi: VAULT_FACTORY_ABI,
  functionName: "totalVaults",
});
console.log("totalVaults   :", total);

const stale = await publicClient.readContract({
  address: as0x(addresses.priceFeed),
  abi: PRICE_FEED_ABI,
  functionName: "maxStaleness",
});
console.log("maxStaleness  :", stale, "s");

console.log("--- MockOracle prices (price source) ---");
const prices = await priceMonitorService.readOraclePrices();
for (const p of prices) console.log("  ", p.token, "=", formatUnits(p.price, 18));

console.log("--- vaults from factory ---");
const vaults = await rebalancerService.listVaults();
console.log("  ", vaults.length, "vault(s):", vaults);
