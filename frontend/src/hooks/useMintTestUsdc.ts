"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/addresses";
import { mantleSepolia } from "@/lib/chains";

// Dev-only faucet. MockUSDC.mint is permissionless on testnet. This is the ONE
// place we sign a contract write directly (not via the backend) — it is a test
// convenience, not a product action.
const MINT_ABI = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/** Mint test USDC to the connected wallet (default 1,000). Testnet only. */
export function useMintTestUsdc() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending, error, reset } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const mint = (amount = 1000) => {
    if (!address) return;
    writeContract({
      address: USDC_ADDRESS,
      abi: MINT_ABI,
      functionName: "mint",
      args: [address, parseUnits(String(amount), USDC_DECIMALS)],
      chainId: mantleSepolia.id, // wagmi switches the wallet to Mantle Sepolia
    });
  };

  return { mint, isPending, isConfirming, isSuccess, error, reset };
}
