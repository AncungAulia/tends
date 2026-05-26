import { useReadContracts } from "wagmi";
import { PriceFeedAbi } from "@/lib/abis/PriceFeedAbi";
import { ADDRESSES } from "@/lib/addresses";
import { parsePriceResult, type PriceStatus } from "@/lib/price";

const PRICE_TOKENS: { symbol: string; address: `0x${string}` }[] = [
  { symbol: "USDY", address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8" },
  { symbol: "mETH", address: "0xD89395Df78aaFdF86b330899d1C6189211e88750" },
  { symbol: "AAPL", address: "0xc2226548fb4332dce1e31dc317bcf61effd51375" },
  { symbol: "XAU", address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1" },
  { symbol: "MSFT", address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63" },
];

export interface PriceRow {
  symbol: string;
  address: `0x${string}`;
  priceUSD: number | null;
  status: PriceStatus;
  updatedAt: Date | null;
}

export function usePrices() {
  const { data, isLoading } = useReadContracts({
    contracts: PRICE_TOKENS.map((t) => ({
      address: ADDRESSES.PRICE_FEED as `0x${string}`,
      abi: PriceFeedAbi,
      functionName: "getPriceUnsafe" as const,
      args: [t.address] as [`0x${string}`],
    })),
  });

  const prices: PriceRow[] = PRICE_TOKENS.map((token, i) => {
    const raw = data?.[i]?.result as readonly [bigint, bigint] | undefined;
    const { priceUSD, status, updatedAt } = parsePriceResult(raw);
    return { symbol: token.symbol, address: token.address, priceUSD, status, updatedAt };
  });

  return { prices, isLoading };
}
