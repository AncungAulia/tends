import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { UserVaultAbi } from "@/lib/abis/UserVaultAbi";
import { getTokenByAddress, type Token } from "@/lib/tokens";

/**
 * Reads the vault's allowedTokens array dynamically (don't hardcode). Reads
 * index by index until the call reverts (end of array).
 */
export function useAllowedTokens(vaultAddress: `0x${string}` | undefined) {
  const publicClient = usePublicClient();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!vaultAddress || !publicClient) return;
    let cancelled = false;

    const fetchTokens = async () => {
      setIsLoading(true);
      const result: Token[] = [];
      let i = 0;

      while (true) {
        try {
          const addr = (await publicClient.readContract({
            address: vaultAddress,
            abi: UserVaultAbi,
            functionName: "allowedTokens",
            args: [BigInt(i)],
          })) as `0x${string}`;
          const token = getTokenByAddress(addr);
          if (token) result.push(token);
          i++;
          if (i > 100) break; // safety cap
        } catch {
          break; // end of array
        }
      }

      if (!cancelled) {
        setTokens(result);
        setIsLoading(false);
      }
    };

    fetchTokens();
    return () => {
      cancelled = true;
    };
  }, [vaultAddress, publicClient]);

  return { tokens, isLoading };
}
