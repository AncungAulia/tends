"use client";

import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useBackendTx } from "@/hooks/useBackendTx";
import { useVaultStore } from "@/hooks/useVaultStore";
import { VaultFactoryAbi } from "@/lib/abis/VaultFactoryAbi";
import { ADDRESSES, ZERO_ADDRESS } from "@/lib/addresses";

interface Position {
  vault: null | {
    address: `0x${string}`;
    riskPreference: number;
    // Cost basis (total deposited, USDC base units) — used for real P&L delta.
    initialDeposit?: string;
  };
}

/**
 * Vault address. Primary source: backend `/position`. Fallback: on-chain
 * `vaultOf(address)` — so a vault that exists on-chain is still detected when
 * the backend DB/indexer is lagging (avoids the "deploy again → VaultAlreadyExists"
 * trap). Deploy goes through the backend.
 */
export function useUserVault() {
  const { getAccessToken, authenticated } = usePrivy();
  // Address from the Privy wallet (works for embedded wallets) — wagmi's useAccount is
  // empty unless an injected connector is active, which broke the on-chain vault fallback.
  const { wallets } = useWallets();
  const address = wallets[0]?.address as `0x${string}` | undefined;
  const setVaultAddress = useVaultStore((s) => s.setVaultAddress);

  const {
    data: position,
    isLoading: positionLoading,
    refetch: refetchPosition,
  } = useQuery({
    queryKey: ["position"],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiFetch<Position>("/api/users/me/position", token);
    },
  });

  const backendVault = position?.vault?.address;

  // On-chain fallback — only when the backend has no vault for this user.
  const {
    data: onchainRaw,
    isLoading: onchainLoading,
    refetch: refetchOnchain,
  } = useReadContract({
    address: ADDRESSES.VAULT_FACTORY,
    abi: VaultFactoryAbi,
    functionName: "vaultOf",
    args: [address!],
    query: { enabled: !!address && !backendVault },
  });

  const onchainVault =
    onchainRaw && onchainRaw !== ZERO_ADDRESS
      ? (onchainRaw as `0x${string}`)
      : undefined;

  const vaultAddress = (backendVault ?? onchainVault) as `0x${string}` | undefined;
  const hasVault = !!vaultAddress;
  const initialDeposit = position?.vault?.initialDeposit;
  const isVaultLoading =
    positionLoading || (!backendVault && !!address && onchainLoading);

  useEffect(() => {
    setVaultAddress(vaultAddress);
  }, [vaultAddress, setVaultAddress]);

  const { execute, isPending, isConfirming, state, error, reset } = useBackendTx();

  const refetch = async () => {
    await Promise.all([refetchPosition(), refetchOnchain()]);
  };

  const deployVault = async () => {
    await execute("/api/users/me/deploy-vault", {});
    // Vault address arrives via the indexer (backend) or the on-chain fallback.
    const poll = setInterval(() => {
      refetch();
    }, 3000);
    setTimeout(() => clearInterval(poll), 30_000);
  };

  return {
    vaultAddress,
    hasVault,
    initialDeposit,
    isVaultLoading,
    deployVault,
    isPending,
    isConfirming,
    state,
    error,
    reset,
    refetch,
  };
}
