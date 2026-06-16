"use client";

import { useBackendTx } from "@/hooks/useBackendTx";

/**
 * Hard on-chain agent controls (BE-A). Each goes through the backend, which
 * returns an unsigned tx (or steps) targeting the user's own vault; the owner
 * signs via Privy. The vault address is passed to the signer so its target
 * passes the whitelist check.
 *
 *  - emergencyPause / emergencyUnpause: pause/resume the vault ON-CHAIN. Deposits
 *    and rebalances are blocked while paused; withdraw always works. This is the
 *    HARD pause, distinct from the soft "auto-rebalance off" DB flag at
 *    PATCH /agent/pause (see useAgentActions).
 *  - setFrequency: set the on-chain minimum rebalance interval, in seconds
 *    (0 = no on-chain cooldown; the backend bounds the value).
 *  - setAllowed: add/remove tokens from the vault's tradeable allow-list. Passing
 *    allowed=false is the "avoid" action (removes tokens from the list).
 */
export function useAgentControls(vaultAddress: `0x${string}` | undefined) {
  const tx = useBackendTx();

  const emergencyPause = (reason?: string) => {
    if (!vaultAddress) return;
    return tx.execute(
      "/api/users/me/prepare-pause",
      { vault: vaultAddress, ...(reason ? { reason } : {}) },
      vaultAddress,
    );
  };

  const emergencyUnpause = () => {
    if (!vaultAddress) return;
    return tx.execute(
      "/api/users/me/prepare-unpause",
      { vault: vaultAddress },
      vaultAddress,
    );
  };

  const setFrequency = (intervalSec: number) => {
    if (!vaultAddress) return;
    return tx.execute(
      "/api/users/me/prepare-set-frequency",
      { vault: vaultAddress, intervalSec },
      vaultAddress,
    );
  };

  const setAllowed = (tokens: string[], allowed: boolean) => {
    if (!vaultAddress || tokens.length === 0) return;
    return tx.execute(
      "/api/users/me/prepare-set-allowed",
      { vault: vaultAddress, tokens, allowed },
      vaultAddress,
    );
  };

  return {
    emergencyPause,
    emergencyUnpause,
    setFrequency,
    setAllowed,
    state: tx.state,
    error: tx.error,
    isPending: tx.isPending,
    isConfirming: tx.isConfirming,
    isSuccess: tx.isSuccess,
    reset: tx.reset,
  };
}
