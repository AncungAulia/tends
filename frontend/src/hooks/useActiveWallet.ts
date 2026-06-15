"use client";

import { useAccount } from "wagmi";
import { useWallets } from "@privy-io/react-auth";

/**
 * Single source of truth for "which wallet the user is acting as".
 *
 * The app uses @privy-io/wagmi, so wagmi's `useAccount()` tracks the ACTIVE
 * connector — i.e. the wallet the user connected/switched to via the Sidebar
 * "Connect Wallet" button (Rabby / MetaMask / Phantom / embedded / …). We resolve
 * the matching Privy wallet object so signing (useBackendTx) and vault detection
 * (useUserVault) BOTH act on that exact wallet instead of blindly grabbing
 * `wallets[0]`, which is what made deploy/deposit sign with "some random wallet".
 *
 * Falls back to the first linked wallet only while the connector address is still
 * propagating right after connect.
 */
export function useActiveWallet() {
  const { address } = useAccount();
  const { wallets } = useWallets();

  const matched = address
    ? wallets.find((w) => w.address?.toLowerCase() === address.toLowerCase())
    : undefined;
  const wallet = matched ?? wallets[0];

  return {
    /** Active wallet address (what the Sidebar shows). */
    address: (address ?? wallet?.address) as `0x${string}` | undefined,
    /** Privy wallet object for signing — the same active wallet. */
    wallet,
    /** All linked wallets (for a picker, if needed). */
    wallets,
  };
}
