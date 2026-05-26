import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { PRICE_FEED_ABI } from "../chain/abis.js";
import { TOKENS, type TokenSymbol } from "../chain/tokens.js";
import { currentApy, type ApyByToken } from "./projection.js";
import { env } from "../config/env.js";

const log = childLogger("apy");

/**
 * Tokens whose USD price drift IS the yield → realized APY is derivable from price
 * snapshots. ETH-staking (mETH/cmETH) and WMNT have USD prices dominated by ETH
 * volatility, not yield, so they keep the configured estimate.
 */
export const DERIVABLE_APY: TokenSymbol[] = ["USDY", "sUSDe"];
const WINDOW_DAYS = 7;
const MS_PER_DAY = 86_400_000;
const MIN_SPAN_DAYS = 1; // shorter spans annualize price noise into absurd APY
/** Plausible band for a stablecoin-ish yield; outside ⇒ noise ⇒ fall back to estimate. */
export const SANE_APY = { min: -5, max: 100 };

/** Pure: compounded annualized % from old→new (18-dec) over daysElapsed. null if invalid. */
export function annualizedApy(
  oldWad: bigint,
  newWad: bigint,
  daysElapsed: number,
): number | null {
  if (oldWad <= 0n || newWad <= 0n || daysElapsed <= 0) return null;
  // ratio to 6 decimals via integer division (avoids float precision loss on 1e18).
  const ratio = Number((newWad * 1_000_000n) / oldWad) / 1_000_000;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return (ratio ** (365 / daysElapsed) - 1) * 100;
}

export interface Snap {
  priceWad: string;
  snapshotAt: Date;
}

/** Pure: realized APY from a window of snapshots (oldest→newest). null if insufficient. */
export function apyFromSnapshots(snaps: Snap[]): number | null {
  if (snaps.length < 2) return null;
  const first = snaps[0]!;
  const last = snaps[snaps.length - 1]!;
  const days = (last.snapshotAt.getTime() - first.snapshotAt.getTime()) / MS_PER_DAY;
  if (days < MIN_SPAN_DAYS) return null; // too short → annualization is just noise
  return annualizedApy(BigInt(first.priceWad), BigInt(last.priceWad), days);
}

export interface ApyRepo {
  saveSnapshot(asset: string, priceWad: string): Promise<void>;
  recordApy(asset: string, apyPct: number): Promise<void>;
  windowSnapshots(asset: string, sinceDays: number): Promise<Snap[]>;
}

export const prismaApyRepo: ApyRepo = {
  saveSnapshot: async (asset, priceWad) => {
    await prisma.priceSnapshot.create({ data: { asset, priceWad } });
  },
  recordApy: async (asset, apyPct) => {
    await prisma.apyHistory.create({ data: { asset, apy: apyPct } });
  },
  windowSnapshots: (asset, sinceDays) =>
    prisma.priceSnapshot.findMany({
      where: { asset, snapshotAt: { gte: new Date(Date.now() - sinceDays * MS_PER_DAY) } },
      orderBy: { snapshotAt: "asc" },
      select: { priceWad: true, snapshotAt: true },
    }),
};

/**
 * Realized-APY service. Snapshots PriceFeed prices over time and derives an
 * annualized yield for USD-stable yield tokens; everything else uses the
 * configured estimate (currentApy). Replaces the static-only scraper.
 */
export class ApyService {
  constructor(private readonly repo: ApyRepo = prismaApyRepo) {}

  /** Snapshot current prices for the derivable tokens. */
  async snapshotPrices(): Promise<void> {
    if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) return;
    for (const sym of DERIVABLE_APY) {
      const t = TOKENS[sym];
      if (!t.address) continue;
      const [price] = await publicClient.readContract({
        address: as0x(addresses.priceFeed),
        abi: PRICE_FEED_ABI,
        functionName: "getPriceUnsafe",
        args: [as0x(t.address)],
      });
      await this.repo.saveSnapshot(sym, price.toString());
    }
  }

  async derivedApy(asset: string, windowDays = WINDOW_DAYS): Promise<number | null> {
    return apyFromSnapshots(await this.repo.windowSnapshots(asset, windowDays));
  }

  /** APY map = configured estimate, with derived values where available. Resilient:
   *  a failed read (e.g. DB down) falls back to the estimate rather than throwing. */
  async getApyMap(): Promise<ApyByToken> {
    const map: ApyByToken = { ...currentApy() };
    for (const sym of DERIVABLE_APY) {
      try {
        const d = await this.derivedApy(sym);
        if (d != null && d >= SANE_APY.min && d <= SANE_APY.max) {
          map[sym] = Math.round(d * 100) / 100;
        } // out-of-band (noise) → keep the estimate
      } catch (err) {
        log.warn({ sym, err }, "derived APY failed — using estimate");
      }
    }
    return map;
  }

  /** Scheduler job: snapshot prices, then record the current APY map to history. */
  async run(): Promise<void> {
    await this.snapshotPrices();
    const map = await this.getApyMap();
    for (const [asset, apy] of Object.entries(map)) await this.repo.recordApy(asset, apy ?? 0);
    log.info({ assets: Object.keys(map).length }, "apy snapshot + history written");
  }
}

export const apyService = new ApyService();
