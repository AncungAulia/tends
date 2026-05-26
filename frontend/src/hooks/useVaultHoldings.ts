import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { PriceFeedAbi } from "@/lib/abis/PriceFeedAbi";
import { ADDRESSES } from "@/lib/addresses";
import { parsePriceResult, type PriceStatus } from "@/lib/price";

// Tokens that can appear in a vault (subset of the full catalog kept small
// to limit the multicall size). Extend as needed.
export const VAULT_TOKENS = [
  { symbol: "USDC", address: "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD", decimals: 6 },
  { symbol: "mUSD", address: "0xADA0466303441102cb16F8eC1594C744d603f746", decimals: 18 },
  { symbol: "USDY", address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8", decimals: 18 },
  { symbol: "mETH", address: "0xD89395Df78aaFdF86b330899d1C6189211e88750", decimals: 18 },
  { symbol: "cmETH", address: "0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF", decimals: 18 },
  { symbol: "sUSDe", address: "0xF76DA0ec605CFac82f1DA86080da21316C07d130", decimals: 18 },
  { symbol: "WMNT", address: "0x61a4ac2678048ED431E362c14D2eC7A0B3191966", decimals: 18 },
  { symbol: "XAU", address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1", decimals: 18 },
  { symbol: "AAPL", address: "0xc2226548fb4332dce1e31dc317bcf61effd51375", decimals: 18 },
  { symbol: "MSFT", address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63", decimals: 18 },
  { symbol: "NVDA", address: "0x6ceaf0d037e628d8c08e1462f628bde4da633813", decimals: 18 },
  { symbol: "TSLA", address: "0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523", decimals: 18 },
  { symbol: "BUIDL", address: "0x92cf957248c8a695da67d91835bd02e6371e5bfd", decimals: 18 },
  { symbol: "ONDO", address: "0x4e3a788cd351f73d70c85f640758d90d7c573a4d", decimals: 18 },
] as const;

export interface Holding {
  symbol: string;
  address: string;
  decimals: number;
  balance: bigint;
  balanceHuman: number;
  priceUSD: number | null;
  priceStatus: PriceStatus;
  valueUSD: number | null;
}

export function useVaultHoldings(vaultAddress: `0x${string}` | undefined) {
  const { data: balances, isLoading: loadingBalances } = useReadContracts({
    contracts: VAULT_TOKENS.map((t) => ({
      address: t.address as `0x${string}`,
      abi: ERC20Abi,
      functionName: "balanceOf" as const,
      args: [vaultAddress!] as [`0x${string}`],
    })),
    query: { enabled: !!vaultAddress, refetchInterval: 30_000 },
  });

  const { data: prices, isLoading: loadingPrices } = useReadContracts({
    contracts: VAULT_TOKENS.map((t) => ({
      address: ADDRESSES.PRICE_FEED as `0x${string}`,
      abi: PriceFeedAbi,
      functionName: "getPriceUnsafe" as const,
      args: [t.address as `0x${string}`] as [`0x${string}`],
    })),
    query: { enabled: !!vaultAddress },
  });

  const holdings: Holding[] = VAULT_TOKENS.map((token, i) => {
    const rawBalance = (balances?.[i]?.result as bigint | undefined) ?? 0n;
    const rawPrice = prices?.[i]?.result as
      | readonly [bigint, bigint]
      | undefined;
    const parsed = parsePriceResult(rawPrice);
    // USDC is the vault's unit of account (1 USDC = $1); the oracle doesn't
    // price it, so value it directly instead of rendering "--".
    const isUsdc = token.symbol === "USDC";
    const priceUSD = isUsdc ? 1 : parsed.priceUSD;
    const status = isUsdc ? "available" : parsed.status;

    const balanceHuman = Number(formatUnits(rawBalance, token.decimals));
    const valueUSD =
      status === "available" && priceUSD !== null
        ? balanceHuman * priceUSD
        : null;

    return {
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      balance: rawBalance,
      balanceHuman,
      priceUSD,
      priceStatus: status,
      valueUSD,
    };
  })
    .filter((h) => h.balance > 0n)
    .sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0));

  const totalValueUSD = holdings.reduce((sum, h) => sum + (h.valueUSD ?? 0), 0);

  return {
    holdings,
    totalValueUSD,
    isLoading: loadingBalances || loadingPrices,
  };
}
