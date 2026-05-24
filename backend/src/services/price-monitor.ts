import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { MOCK_ORACLE_ABI, PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS, feedId, type TokenSymbol } from "../chain/tokens.js";

const log = childLogger("price-monitor");

export interface FeedStatus {
  symbol: TokenSymbol;
  price: bigint; // 18-dec USD, 0 if unconfigured
  updatedAt: bigint; // 0 if unconfigured/static
  ageSeconds: number;
  stale: boolean;
}

/**
 * Pure: is a feed stale at `now` given `maxStaleness`? updatedAt 0 = unset = stale.
 * ageSeconds is clamped to a safe integer for the unset case.
 */
export function classifyFreshness(
  now: bigint,
  maxStaleness: bigint,
  updatedAt: bigint,
): { ageSeconds: number; stale: boolean } {
  if (updatedAt === 0n) return { ageSeconds: Number.MAX_SAFE_INTEGER, stale: true };
  const age = now - updatedAt;
  return { ageSeconds: Number(age), stale: age > maxStaleness };
}

export interface PriceMonitorDeps {
  readNow: () => Promise<bigint>;
  readMaxStaleness: () => Promise<bigint>;
  readPriceUnsafe: (token: `0x${string}`) => Promise<readonly [bigint, bigint]>;
}

export const defaultPriceMonitorDeps: PriceMonitorDeps = {
  readNow: () => publicClient.getBlock().then((b) => b.timestamp),
  readMaxStaleness: () =>
    publicClient.readContract({
      address: as0x(addresses.priceFeed),
      abi: PRICE_FEED_ABI,
      functionName: "maxStaleness",
    }),
  readPriceUnsafe: (token) =>
    publicClient.readContract({
      address: as0x(addresses.priceFeed),
      abi: PRICE_FEED_ABI,
      functionName: "getPriceUnsafe",
      args: [token],
    }),
};

/**
 * Read-only price monitor.
 *
 * Price pipeline (the relayer is part of the backend domain — ported into
 * services/relayer.ts, reference at ~/rwa-oracle):
 *
 *   RedStone pull feeds + Ondo USDY (mainnet)
 *        └─ relayer → MockOracle.setPrices()   (~hourly, 18-dec)
 *             └─ PriceFeed.getPrice() reads MockOracle live (PULL)
 *                  └─ rebalancer + this monitor consume it
 *
 * The deployed PriceFeed has NO pushPrices(). This service is read-only: it watches
 * freshness, surfacing stale feeds before they block rebalances (maxStaleness = 2h).
 */
export class PriceMonitorService {
  constructor(private readonly deps: PriceMonitorDeps = defaultPriceMonitorDeps) {}

  /** Reference prices straight from MockOracle (18-dec) for the non-static tokens. */
  async readOraclePrices(): Promise<{ token: `0x${string}`; price: bigint }[]> {
    const out: { token: `0x${string}`; price: bigint }[] = [];
    for (const t of Object.values(TOKENS)) {
      if (t.static || !t.feed || !t.address) continue;
      const [value] = await publicClient.readContract({
        address: as0x(addresses.mockOracle),
        abi: MOCK_ORACLE_ABI,
        functionName: "getPrice",
        args: [feedId(t.feed)],
      });
      out.push({ token: as0x(t.address), price: value });
    }
    return out;
  }

  /** Per-token freshness via PriceFeed.getPriceUnsafe vs maxStaleness. */
  async checkFreshness(): Promise<FeedStatus[]> {
    if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) {
      log.warn("price feed not configured (mock mode)");
      return [];
    }
    const [now, maxStaleness] = await Promise.all([
      this.deps.readNow(),
      this.deps.readMaxStaleness(),
    ]);

    const statuses: FeedStatus[] = [];
    for (const t of Object.values(TOKENS)) {
      if (t.static || !t.address) continue;
      const [price, updatedAt] = await this.deps.readPriceUnsafe(as0x(t.address));
      const { ageSeconds, stale } = classifyFreshness(now, maxStaleness, updatedAt);
      if (stale) log.warn({ symbol: t.symbol, ageSeconds }, "stale price feed");
      statuses.push({ symbol: t.symbol, price, updatedAt, ageSeconds, stale });
    }
    return statuses;
  }
}

export const priceMonitorService = new PriceMonitorService();
