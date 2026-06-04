import { useWatchContractEvent } from "wagmi";
import { VaultFactoryAbi } from "@/lib/abis/VaultFactoryAbi";
import { ADDRESSES } from "@/lib/addresses";

/** Listens for VaultDeployed events from the factory. */
export function useVaultDeployedWatch(
  onDeployed: (user: `0x${string}`, vault: `0x${string}`) => void,
) {
  useWatchContractEvent({
    address: ADDRESSES.VAULT_FACTORY,
    abi: VaultFactoryAbi,
    eventName: "VaultDeployed",
    onLogs: (logs) => {
      for (const log of logs) {
        const { user, vault } = log.args;
        if (user && vault) onDeployed(user, vault);
      }
    },
  });
}
