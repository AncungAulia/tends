import { useReadContracts } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";
import { USDC_DECIMALS, ZERO_ADDRESS } from "@/lib/addresses";

/** Vault summary: total value, user shares, risk, last rebalance, paused. */
export function usePortfolio(
  vaultAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined,
) {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: UserVaultAbi, functionName: "totalAssets" },
      {
        address: vaultAddress,
        abi: UserVaultAbi,
        functionName: "balanceOf",
        // Only user shares need the address; default to zero so the whole
        // batch never gets blocked when the address is briefly unresolved.
        args: [userAddress ?? ZERO_ADDRESS],
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
      { address: vaultAddress, abi: UserVaultAbi, functionName: "paused" },
    ],
    query: { enabled: !!vaultAddress, refetchInterval: 30_000 },
  });

  const [totalAssets, shares, riskPreference, lastRebalanceTime, paused] =
    data ?? [];

  const totalAssetsUSDC = totalAssets?.result
    ? Number(totalAssets.result) / 10 ** USDC_DECIMALS
    : 0;

  return {
    totalAssetsUSDC,
    shares: shares?.result as bigint | undefined,
    riskPreference: riskPreference?.result as number | undefined,
    lastRebalanceTime: lastRebalanceTime?.result as bigint | undefined,
    paused: (paused?.result as boolean | undefined) ?? false,
    isLoading,
    refetch,
  };
}
