"use client";

import { useReadContracts } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";
import { useBackendTx } from "@/hooks/useBackendTx";

export type StrategyId = "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";

/** Reads come direct from the chain; writes go through the backend. */
export function useRiskLevel(vaultAddress: `0x${string}` | undefined) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress!, abi: UserVaultAbi, functionName: "riskPreference" },
      { address: vaultAddress!, abi: UserVaultAbi, functionName: "customAllocation" },
    ],
    query: { enabled: !!vaultAddress },
  });

  const [riskPreference, customAlloc] = data ?? [];

  const { execute, isPending, isConfirming, isSuccess, state, error, reset } =
    useBackendTx();

  /** Switch to a preset strategy (LOW | MEDIUM | HIGH). 1 transaction. */
  const setStrategy = (strategyId: Exclude<StrategyId, "CUSTOM">) => {
    if (!vaultAddress) return;
    return execute(
      "/api/users/me/prepare-switch",
      { vault: vaultAddress, strategyId },
      vaultAddress,
    );
  };

  /** Switch to custom allocation. bps values must sum to 10000. */
  const setCustomStrategy = (lowBps: number, medBps: number, highBps: number) => {
    if (!vaultAddress) return;
    if (lowBps + medBps + highBps !== 10_000) {
      throw new Error("Allocation must sum to 10000 bps (100%)");
    }
    return execute(
      "/api/users/me/prepare-switch",
      {
        vault: vaultAddress,
        strategyId: "CUSTOM",
        customAllocation: { lowBps, medBps, highBps },
      },
      vaultAddress,
    );
  };

  return {
    currentLevel: riskPreference?.result as number | undefined,
    customAlloc: customAlloc?.result as
      | readonly [number, number, number]
      | undefined,
    setStrategy,
    setCustomStrategy,
    isPending,
    isConfirming,
    isSuccess,
    state,
    error,
    reset,
    refetch,
  };
}
