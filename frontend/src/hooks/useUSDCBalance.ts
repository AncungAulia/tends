import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/addresses";

/** USDC balance of the connected user — for the deposit form. */
export function useUSDCBalance(userAddress: `0x${string}` | undefined) {
  const {
    data: raw,
    isLoading,
    refetch,
  } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: "balanceOf",
    args: [userAddress!],
    query: { enabled: !!userAddress, refetchInterval: 30_000 },
  });

  const balance = raw ? formatUnits(raw, USDC_DECIMALS) : "0";
  const balanceRaw = raw ?? 0n;

  return { balance, balanceRaw, isLoading, refetch };
}
