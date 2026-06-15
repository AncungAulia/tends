import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useActiveWallet } from "./useActiveWallet";

/**
 * Fire-and-forget POST /api/auth/verify after login — links the Privy DID to the
 * wallet address in the backend so privyId-keyed endpoints can find the user.
 *
 * Uses the ACTIVE wallet (useActiveWallet), which resolves the embedded wallet for
 * email/Google logins too — wagmi's useAccount() alone can be empty for embedded
 * wallets, which meant Google/email users were never synced (privyId ↔ wallet link
 * never created) and every authed onboarding call then failed.
 */
export function useAuthVerify() {
  const { authenticated, getAccessToken } = usePrivy();
  const { address } = useActiveWallet();
  const verified = useRef(false);

  useEffect(() => {
    if (!authenticated || !address || verified.current) return;
    verified.current = true;

    (async () => {
      try {
        const token = await getAccessToken();
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ walletAddress: address }),
          },
        );
      } catch {
        // silent — non-blocking
        verified.current = false;
      }
    })();
  }, [authenticated, address, getAccessToken]);
}
