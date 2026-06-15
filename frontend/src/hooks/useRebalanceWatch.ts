import { useWatchContractEvent } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";

/** Listens for the vault's Rebalanced event in real time. */
export function useRebalanceWatch(
  vaultAddress: `0x${string}` | undefined,
  onRebalance: (timestamp: bigint, agent: `0x${string}`) => void,
) {
  useWatchContractEvent({
    address: vaultAddress,
    abi: UserVaultAbi,
    eventName: "Rebalanced",
    enabled: !!vaultAddress,
    onLogs: (logs) => {
      for (const log of logs) {
        const { timestamp, agent } = log.args;
        if (timestamp !== undefined && agent) {
          onRebalance(timestamp, agent);
        }
      }
    },
  });
}
