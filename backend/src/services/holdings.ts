import { formatUnits } from "viem";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { ERC20_ABI, PRICE_FEED_ABI, USER_VAULT_ABI } from "../chain/abis.js";
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
 *
 * IMPORTANT: totalValueUsd/totalValueWad come from UserVault.totalAssets() (authoritative)
 * not from summing individual token reads. This ensures tokens outside the TOKENS env dict
 * (e.g. USA500, AAPL, GILTS added to vault's allowedTokens) are still counted in the total.
 * The per-token breakdown only lists tokens we know about from env vars.
 */
export async function readHoldings(vault: `0x${string}`): Promise<VaultHoldings> {
  // Read authoritative total first (single call, no rate-limit pressure).
  const totalAssetsRaw = await publicClient.readContract({
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: "totalAssets",
  });
  // totalAssets() returns 6-dec USDC; convert to 18-dec WAD for consistent math.
  const totalValueWad = (totalAssetsRaw as bigint) * 10n ** 12n;

  // Per-token breakdown: sequential to stay within DRPC free-tier rate limits.
  const rows: { symbol: string; address: string; balance: bigint; wad: bigint; decimals: number }[] =
    [];
  for (const t of Object.values(TOKENS)) {
    if (!t.address) continue;
    try {
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
      if ((balance as bigint) === 0n) continue;
      const wad = valueUsd({
        symbol: t.symbol,
        address: as0x(t.address),
        decimals: t.decimals,
        balance: balance as bigint,
        price: price as bigint,
      });
      // Skip dust: ignore holdings worth less than $0.01
      if (wad < 10_000_000_000_000_000n) continue;
      rows.push({ symbol: t.symbol, address: t.address, balance: balance as bigint, wad, decimals: t.decimals });
    } catch {
      // Skip tokens where RPC call fails (rate limit, missing contract, etc.)
    }
  }

  const holdings: Holding[] = rows.map((r) => ({
    symbol: r.symbol,
    address: r.address,
    balance: formatUnits(r.balance, r.decimals),
    valueUsd: formatUnits(r.wad, 18),
    allocationPct: totalValueWad > 0n ? Number((r.wad * 10_000n) / totalValueWad) / 100 : 0,
  }));

  return {
    holdings,
    totalValueUsd: formatUnits(totalValueWad, 18),
    totalValueWad,
  };
}
