import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";

const log = childLogger("pricing");

const COINGECKO_IDS = {
  MNT: "mantle",
  mETH: "mantle-staked-ether",
  cmETH: "mantle-restaked-eth",
  mUSD: "mantle-usd",
  USDY: "ondo-us-dollar-yield",
  USDe: "ethena-usde",
  sUSDe: "ethena-staked-usde",
  USDC: "usd-coin",
} as const;

export type PriceAsset = keyof typeof COINGECKO_IDS;

/** USD spot prices from CoinGecko with a short in-memory cache (docs §A.6). */
export class PricingService {
  private cache = new Map<string, { value: number; expiresAt: number }>();
  private readonly ttlMs = 30_000;

  async getPrice(asset: PriceAsset): Promise<number> {
    const cached = this.cache.get(asset);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const ids = Object.values(COINGECKO_IDS).join(",");
    const url = new URL("https://api.coingecko.com/api/v3/simple/price");
    url.searchParams.set("ids", ids);
    url.searchParams.set("vs_currencies", "usd");

    const headers: Record<string, string> = {};
    if (env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = env.COINGECKO_API_KEY;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      log.error({ status: res.status }, "coingecko fetch failed");
      return cached?.value ?? 0;
    }
    const data = (await res.json()) as Record<string, { usd?: number }>;

    const now = Date.now();
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      this.cache.set(symbol, {
        value: data[geckoId]?.usd ?? 0,
        expiresAt: now + this.ttlMs,
      });
    }
    return this.cache.get(asset)?.value ?? 0;
  }
}

export const pricingService = new PricingService();
