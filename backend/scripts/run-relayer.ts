// One-shot relayer run for manual testing: pushes one batch to MockOracle and
// confirms a sample feed's updatedAt advanced. Usage: pnpm relayer:once
import { publicClient } from "../src/chain/index.js";
import { addresses, as0x } from "../src/chain/addresses.js";
import { MOCK_ORACLE_ABI } from "../src/chain/abis.js";
import { feedId } from "../src/chain/tokens.js";
import { relayerService } from "../src/services/relayer.js";

const sample = feedId("MNT");
const before = await publicClient.readContract({
  address: as0x(addresses.mockOracle),
  abi: MOCK_ORACLE_ABI,
  functionName: "getPrice",
  args: [sample],
});
console.log("MNT before :", before);

const hash = await relayerService.relayOnce();
console.log("tx hash    :", hash);
if (hash) {
  const rcpt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("status     :", rcpt.status, "| gas", rcpt.gasUsed);
  const after = await publicClient.readContract({
    address: as0x(addresses.mockOracle),
    abi: MOCK_ORACLE_ABI,
    functionName: "getPrice",
    args: [sample],
  });
  console.log("MNT after  :", after);
  console.log(after[1] > before[1] ? "✓ updatedAt advanced — relay landed" : "… updatedAt unchanged");
}
