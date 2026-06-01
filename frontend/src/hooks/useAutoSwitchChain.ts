"use client";

import { useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { mantleSepolia } from "@/lib/chains";

/**
 * Auto-switches the connected external wallet to Mantle Sepolia on login.
 * Privy embedded wallets are already pinned to the correct chain via
 * `defaultChain` in providers.tsx — only external wallets need a nudge.
 */
export function useAutoSwitchChain() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;

    const wallet = wallets[0];

    // Embedded wallets are already on the right chain — skip them.
    if (wallet.walletClientType === "privy") return;

    // chainId comes as "eip155:5003"
    const currentChainId = Number(wallet.chainId?.split(":")[1]);
    if (currentChainId === mantleSepolia.id) return;

    wallet.switchChain(mantleSepolia.id).catch(() => {
      // User rejected or wallet doesn't support programmatic switching.
      // useBackendTx will retry before each tx anyway.
    });
  }, [authenticated, wallets]);
}
