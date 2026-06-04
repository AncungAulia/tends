"use client";

import { useBackendTx } from "@/hooks/useBackendTx";

/**
 * Deposit via backend. Backend returns `steps: [approveTx, depositTx]` — 2 txs
 * signed back-to-back. `amount` is a plain USDC number (backend scales to 6dp).
 */
export function useDeposit() {
  const { execute, state, isPending, isConfirming, isSuccess, error, reset } =
    useBackendTx();

  const deposit = (vaultAddress: string, userAddress: string, amount: number) =>
    execute(
      "/api/users/me/prepare-deposit",
      { vault: vaultAddress, account: userAddress, amount },
      vaultAddress,
    );

  return { deposit, state, isPending, isConfirming, isSuccess, error, reset };
}
