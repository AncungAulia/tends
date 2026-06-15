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

/** A live-protocol APY source: current % for a pool, or null → fall back. */
export type PoolApyFetch = (pool: string) => Promise<number | null>;

/**
 * Real mainnet protocol APY per token, via DeFiLlama's per-pool chart endpoint
 * (keyless, stable pool ids). Tokens without a reliable free source — Mantle's
 * mETH/cmETH/mUSD and MNT staking — keep the curated DEFAULT_APY_PCT estimate.
 */
export const LIVE_APY_POOLS: Partial<Record<TokenSymbol, string>> = {
  sUSDe: "66985a81-9c51-46ca-9977-42b4fe7bc6df", // Ethena staked USDe
  USDY: "ac61ee82-2fe4-4f9b-a9cd-7fb33f598859", // Ondo USDY (tokenized US Treasuries)
};

/** Fetch a pool's current APY (%) from DeFiLlama. Null on any failure/bad shape. */
export const defiLlamaApy: PoolApyFetch = async (pool) => {
  try {
    const res = await fetch(`https://yields.llama.fi/chart/${pool}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { apy: number | null }[] };
    const apy = json.data?.[json.data.length - 1]?.apy;
    return typeof apy === "number" && Number.isFinite(apy) ? apy : null;
  } catch {
    return null;
  }
};

export interface ApyRepo {
  saveSnapshot(asset: string, priceWad: string): Promise<void>;
  recordApy(asset: string, apyPct: number): Promise<void>;
  windowSnapshots(asset: string, sinceDays: number): Promise<Snap[]>;
  /** Latest recorded APY (%) per asset — the cache getApyMap reads. */
  latestApy(): Promise<Record<string, number>>;
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
  latestApy: async () => {
    const rows = await prisma.apyHistory.findMany({
      orderBy: { snapshotAt: "desc" },
      distinct: ["asset"],
      select: { asset: true, apy: true },
    });
    return Object.fromEntries(rows.map((r) => [r.asset, Number(r.apy)]));
  },
};

/** Read a token's PriceFeed price (18-dec wad) on-chain. Injectable for tests. */
export type FeedPriceRead = (tokenAddr: string) => Promise<bigint>;

const defaultReadFeedPrice: FeedPriceRead = async (tokenAddr) => {
  const [price] = await publicClient.readContract({
    address: as0x(addresses.priceFeed),
    abi: PRICE_FEED_ABI,
    functionName: "getPriceUnsafe",
    args: [as0x(tokenAddr)],
  });
  return price;
};

/**
 * APY service. Each scheduler run() refreshes per-token yield — live protocol rate
 * (DeFiLlama) > on-chain price-snapshot derivation > curated estimate — and CACHES
 * it to apyHistory. getApyMap() (per request) just reads that cache, so /api/strategies
 * stays fast and never calls an external API inline.
 */
export class ApyService {
  constructor(
    private readonly repo: ApyRepo = prismaApyRepo,
    // mock token prices don't track real yield → skip on-chain snapshot/derivation
    private readonly useMock: boolean = env.USE_MOCK_CONTRACTS,
    // live-protocol APY source (DeFiLlama by default; injectable for tests)
    private readonly fetchPoolApy: PoolApyFetch = defiLlamaApy,
    // on-chain PriceFeed reader (injectable for tests)
    private readonly readFeedPrice: FeedPriceRead = defaultReadFeedPrice,
  ) {}

  /** Snapshot current prices for the derivable tokens. */
  async snapshotPrices(): Promise<void> {
    if (this.useMock || !addresses.priceFeed) return;
    for (const sym of DERIVABLE_APY) {
      const t = TOKENS[sym];
      if (!t.address) continue;
      const price = await this.readFeedPrice(t.address);
      await this.repo.saveSnapshot(sym, price.toString());
    }
  }

  async derivedApy(asset: string, windowDays = WINDOW_DAYS): Promise<number | null> {
    return apyFromSnapshots(await this.repo.windowSnapshots(asset, windowDays));
  }

  /** Pull live protocol APYs (real mainnet rates) for tokens with a source.
   *  Per-token failures are swallowed (omitted → caller falls back to estimate). */
  async fetchLiveApy(): Promise<ApyByToken> {
    const entries = Object.entries(LIVE_APY_POOLS) as [TokenSymbol, string][];
    const results = await Promise.all(
      entries.map(async ([sym, pool]) => {
        try {
          return [sym, await this.fetchPoolApy(pool)] as const;
        } catch {
          return [sym, null] as const;
        }
      }),
    );
    const out: ApyByToken = {};
    for (const [sym, apy] of results) {
      if (apy != null && apy >= SANE_APY.min && apy <= SANE_APY.max) {
        out[sym] = Math.round(apy * 100) / 100;
      }
    }
    return out;
  }

  /**
   * Effective APY map served to callers (e.g. /api/strategies). Reads the latest
   * CACHED per-asset APY (written by run() from live + derived sources) and layers
   * it over the estimate — so requests are fast (no external calls per request).
   * Resilient: a failed read or mock mode falls back to the estimate.
   */
  async getApyMap(): Promise<ApyByToken> {
    const map: ApyByToken = { ...currentApy() };
    if (this.useMock) return map; // mock prices ≠ real yield
    try {
      const cached = await this.repo.latestApy();
      for (const [asset, apy] of Object.entries(cached)) {
        if (asset in TOKENS && apy >= SANE_APY.min && apy <= SANE_APY.max) {
          map[asset as TokenSymbol] = apy;
        }
      }
    } catch (err) {
      log.warn({ err }, "cached APY read failed — using estimate");
    }
    return map;
  }

  /**
   * Scheduler job: snapshot prices, then refresh + cache the APY map. Priority per
   * token: live protocol rate (DeFiLlama) > on-chain snapshot derivation > estimate.
   */
  async run(): Promise<void> {
    await this.snapshotPrices();
    const map: ApyByToken = { ...currentApy() };

    const live = await this.fetchLiveApy(); // real mainnet rates where available
    Object.assign(map, live);

    if (!this.useMock) {
      for (const sym of DERIVABLE_APY) {
        if (sym in live) continue; // a live source already covers it
        try {
          const d = await this.derivedApy(sym);
          if (d != null && d >= SANE_APY.min && d <= SANE_APY.max) {
            map[sym] = Math.round(d * 100) / 100;
          }
        } catch (err) {
          log.warn({ sym, err }, "derived APY failed — using estimate");
        }
      }
    }

    for (const [asset, apy] of Object.entries(map)) await this.repo.recordApy(asset, apy ?? 0);
    log.info(
      { assets: Object.keys(map).length, live: Object.keys(live).length },
      "apy snapshot + history written",
    );
  }
}

export const apyService = new ApyService();
