import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20Abi } from "@/lib/abis/ERC20Abi";
import { PriceFeedAbi } from "@/lib/abis/PriceFeedAbi";
import { ADDRESSES } from "@/lib/addresses";
import { parsePriceResult, type PriceStatus } from "@/lib/price";

// Full token catalog — all tokens that can appear in a vault.
export const VAULT_TOKENS = [
  // Core stablecoins & liquid assets
  { symbol: "USDC",  address: "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD", decimals: 6  },
  { symbol: "mUSD",  address: "0xADA0466303441102cb16F8eC1594C744d603f746", decimals: 18 },
  { symbol: "USDY",  address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8", decimals: 18 },
  { symbol: "mETH",  address: "0xD89395Df78aaFdF86b330899d1C6189211e88750", decimals: 18 },
  { symbol: "cmETH", address: "0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF", decimals: 18 },
  { symbol: "sUSDe", address: "0xF76DA0ec605CFac82f1DA86080da21316C07d130", decimals: 18 },
  { symbol: "WMNT",  address: "0x61a4ac2678048ED431E362c14D2eC7A0B3191966", decimals: 18 },
  // Bonds
  { symbol: "CETES",   address: "0x1054424a70dae9098babec332e18a0f07d37d251", decimals: 18 },
  { symbol: "GILTS",   address: "0xbea967ace62d23d335ddad03972659509e1c3559", decimals: 18 },
  { symbol: "KTB",     address: "0x10d9eb91d0a69098431fb833e666bd64455d45f3", decimals: 18 },
  { symbol: "TESOURO", address: "0xfda1e869846776e3c182f5e105640ac48d474605", decimals: 18 },
  // Funds / RWA
  { symbol: "ACRED", address: "0x3d85b13c76fc218830e3c0d2e147d1a6b8f3cdc8", decimals: 18 },
  { symbol: "BENJI", address: "0x56514dcf6e038ba1f77530cb9df01b2f9427ea11", decimals: 18 },
  { symbol: "BUIDL", address: "0x92cf957248c8a695da67d91835bd02e6371e5bfd", decimals: 18 },
  { symbol: "ONDO",  address: "0x4e3a788cd351f73d70c85f640758d90d7c573a4d", decimals: 18 },
  { symbol: "VBILL", address: "0xbc58f30dfaae433f5531a037365c06b98960e54a", decimals: 18 },
  // Commodities
  { symbol: "URANIUM", address: "0x1d7939e37e08802a6b86204f8e3c52ba4a6cbfba", decimals: 18 },
  { symbol: "WTI",     address: "0x932e82632e80b06318ca969e33f99a54f1a04b10", decimals: 18 },
  { symbol: "XAG",     address: "0xf380e8b6803ad065ef0567dd20c894a55050737c", decimals: 18 },
  { symbol: "XAU",     address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1", decimals: 18 },
  { symbol: "XAUt",    address: "0x0aa42416baccdb2fd4768b61111deb7f7d212f9b", decimals: 18 },
  { symbol: "XCU",     address: "0xb3e1f06ac529aded2aa20aa38f4c0b4ad317e5f5", decimals: 18 },
  { symbol: "XPT",     address: "0x62e518611d5a135a50c18e5fcf3a333d6d3a0506", decimals: 18 },
  // Indices
  { symbol: "KOSPI200",  address: "0xc43bd39225a38ce33751c55c74741834a8e82d16", decimals: 18 },
  { symbol: "NIKKEI225", address: "0x6289654b4197744800d761a4641ba0c4a79f5ed1", decimals: 18 },
  { symbol: "USA100",    address: "0x7bb9e063dab0b53fb7b7b438548d5a8c62e3afb7", decimals: 18 },
  { symbol: "USA500",    address: "0x6956dbbeb8eca1160ae21d2d703cdf6b86525825", decimals: 18 },
  // Stocks
  { symbol: "AAPL",  address: "0xc2226548fb4332dce1e31dc317bcf61effd51375", decimals: 18 },
  { symbol: "AMZN",  address: "0x5dbc3c81dbbb39dd865ec27c66abb48150325df1", decimals: 18 },
  { symbol: "GOOGL", address: "0xdd63da0a5ec0a76029dd49c32de7de73d8918e96", decimals: 18 },
  { symbol: "META",  address: "0x028ffc7b83ac3ec143bed5a8f14c7e49a356c793", decimals: 18 },
  { symbol: "MSFT",  address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63", decimals: 18 },
  { symbol: "NVDA",  address: "0x6ceaf0d037e628d8c08e1462f628bde4da633813", decimals: 18 },
  { symbol: "PLTR",  address: "0x56979c925faa2b84637f2991c31fd6b1b33624b0", decimals: 18 },
  { symbol: "TSLA",  address: "0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523", decimals: 18 },
  // FX Major
  { symbol: "EUR", address: "0x781dfd2a2e6b2fb23e10a4b36691520e4bc36e2a", decimals: 18 },
  { symbol: "GBP", address: "0x2cbc4431d40121faa5b5a6d15240285761128f5a", decimals: 18 },
  { symbol: "SGD", address: "0x039263c8b98f62f7e2debcd277ef3f1f2baf9dce", decimals: 18 },
  // FX Emerging
  { symbol: "BRL", address: "0xd568d045d34dca3f4f24be8099a8b90779047b6a", decimals: 18 },
  { symbol: "IDR", address: "0x37e11a01f58f973098bef434a34e7fc3be4e3041", decimals: 18 },
  { symbol: "JPY", address: "0x718c268093b11bea78a9b84861b2e4e96e86c33b", decimals: 18 },
  { symbol: "KRW", address: "0x42feae1f60b23feb1f5c501977af161116fe3e99", decimals: 18 },
  { symbol: "TRY", address: "0x58061565f6f2b5c8322ee3fa2dcd6497d72e5b20", decimals: 18 },
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
