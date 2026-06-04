import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { useEffect, useRef } from "react";

/**
 * Fire-and-forget POST /api/auth/verify after wallet connect — links the
 * Privy DID to the wallet address in the backend. Runs once per session,
 * non-blocking.
 */
export function useAuthVerify() {
  const { authenticated, getAccessToken } = usePrivy();
  const { address } = useAccount();
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
