"use client";

import { useBackendTx } from "@/hooks/useBackendTx";

/**
 * Withdraw via backend. Backend returns a single `tx`. `amount` is a plain USDC
 * number (backend scales to 6dp). Always available — even when the vault is paused.
 */
export function useWithdraw() {
  const { execute, state, isPending, isConfirming, isSuccess, error, reset, hashes } =
    useBackendTx();

  const withdraw = (vaultAddress: string, userAddress: string, amount: number) =>
    execute(
      "/api/users/me/prepare-withdraw",
      { vault: vaultAddress, account: userAddress, amount },
      vaultAddress,
    );

  return { withdraw, state, isPending, isConfirming, isSuccess, error, reset, hashes };
}
