import { formatUnits } from "viem";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { ERC20_ABI, PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";
import { valueUsd } from "./rebalance-math.js";

export interface Holding {
  symbol: string;
  address: string;
  balance: string; // human (token decimals)
  valueUsd: string; // human (18-dec formatted)
  allocationPct: number; // share of the portfolio, 2dp
}

export interface VaultHoldings {
  holdings: Holding[];
  totalValueUsd: string; // human
  totalValueWad: bigint; // 18-dec USD
}

/**
 * Read a vault's on-chain token holdings + USD values (via PriceFeed.getPriceUnsafe —
 * unsafe so a slightly-stale feed doesn't make the view revert). Shared by the MCP
 * chat tool and the /holdings + /portfolio endpoints. Tokens with 0 balance are omitted.
 */
export async function readHoldings(vault: `0x${string}`): Promise<VaultHoldings> {
  const rows: { symbol: string; address: string; balance: bigint; wad: bigint; decimals: number }[] =
    [];
  let totalWad = 0n;
  for (const t of Object.values(TOKENS)) {
    if (!t.address) continue;
    const [balance, [price]] = await Promise.all([
      publicClient.readContract({
        address: as0x(t.address),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [vault],
      }),
      publicClient.readContract({
        address: as0x(addresses.priceFeed),
        abi: PRICE_FEED_ABI,
        functionName: "getPriceUnsafe",
        args: [as0x(t.address)],
      }),
    ]);
    if (balance === 0n) continue;
    const wad = valueUsd({
      symbol: t.symbol,
      address: as0x(t.address),
      decimals: t.decimals,
      balance,
      price,
    });
    totalWad += wad;
    rows.push({ symbol: t.symbol, address: t.address, balance, wad, decimals: t.decimals });
  }
  const holdings: Holding[] = rows.map((r) => ({
    symbol: r.symbol,
    address: r.address,
    balance: formatUnits(r.balance, r.decimals),
    valueUsd: formatUnits(r.wad, 18),
    allocationPct: totalWad > 0n ? Number((r.wad * 10_000n) / totalWad) / 100 : 0,
  }));
  return { holdings, totalValueUsd: formatUnits(totalWad, 18), totalValueWad: totalWad };
}
