import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { publicClient, getAgentWallet, activeChain } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { MOCK_ORACLE_ABI, PRICE_FEED_ABI, USER_VAULT_TX_ABI } from "../chain/abis.js";
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

export type BoundReason = "below" | "above" | "zero" | null;

/** Pure: is an 18-dec USD price within [min, max]? (zero = unset/critical). */
export function assessBounds(
  price: bigint,
  min: bigint,
  max: bigint,
): { ok: boolean; reason: BoundReason } {
  if (price === 0n) return { ok: false, reason: "zero" };
  if (price < min) return { ok: false, reason: "below" };
  if (price > max) return { ok: false, reason: "above" };
  return { ok: true, reason: null };
}

const usd = (n: number): bigint => BigInt(Math.round(n * 1e6)) * 10n ** 12n; // USD → 18-dec

/**
 * Sane price bands per token (18-dec USD). USDC/mUSD pegged tight; USDY/sUSDe are
 * yield-bearing so only a floor + generous ceiling. mETH/cmETH/WMNT omitted (volatile).
 */
export const PRICE_BOUNDS: Partial<Record<TokenSymbol, { min: bigint; max: bigint }>> = {
  USDC: { min: usd(0.99), max: usd(1.01) },
  mUSD: { min: usd(0.99), max: usd(1.01) },
  USDY: { min: usd(0.97), max: usd(1.3) },
  sUSDe: { min: usd(0.97), max: usd(1.4) },
};

export interface PriceBoundStatus {
  symbol: TokenSymbol;
  price: bigint;
  ok: boolean;
  reason: BoundReason;
}

/** Pure: breaches that warrant pausing — depeg below floor or unset price. (above = warn only) */
export function criticalBreaches(statuses: PriceBoundStatus[]): PriceBoundStatus[] {
  return statuses.filter((s) => s.reason === "below" || s.reason === "zero");
}

export interface StaleAlert {
  count: number;
  symbols: TokenSymbol[];
  maxAgeSeconds: number;
}

/**
 * Pure: aggregate stale-feed alert (the relayer has likely stopped pushing), or
 * null if every feed is fresh. Distinct from the per-feed warn — this is the loud,
 * error-level signal log-based alerting should page on.
 */
export function staleAlert(statuses: FeedStatus[]): StaleAlert | null {
  const stale = statuses.filter((s) => s.stale);
  if (stale.length === 0) return null;
  return {
    count: stale.length,
    symbols: stale.map((s) => s.symbol),
    maxAgeSeconds: Math.max(...stale.map((s) => s.ageSeconds)),
  };
}

export interface RiskGuardOpts {
  enabled: boolean;
  listVaults: () => Promise<`0x${string}`[]>;
  pauseVault: (vault: `0x${string}`, reason: string) => Promise<`0x${string}`>;
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
    const alert = staleAlert(statuses);
    if (alert) log.error(alert, "ORACLE ALERT: price feeds stale — relayer may be down");
    return statuses;
  }

  /** Flag tokens whose price left its sane band (depeg / anomaly). */
  async checkPrices(): Promise<PriceBoundStatus[]> {
    if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) {
      log.warn("price feed not configured (mock mode)");
      return [];
    }
    const out: PriceBoundStatus[] = [];
    for (const [symbol, bounds] of Object.entries(PRICE_BOUNDS) as [
      TokenSymbol,
      { min: bigint; max: bigint },
    ][]) {
      const t = TOKENS[symbol];
      if (!t.address) continue;
      const [price] = await this.deps.readPriceUnsafe(as0x(t.address));
      const { ok, reason } = assessBounds(price, bounds.min, bounds.max);
      if (!ok) log.warn({ symbol, price: price.toString(), reason }, "price out of bounds");
      out.push({ symbol, price, ok, reason });
    }
    return out;
  }

  /** Freshness + bounds in one pass (scheduler entrypoint). */
  async runChecks(): Promise<{ freshness: FeedStatus[]; bounds: PriceBoundStatus[] }> {
    const [freshness, bounds] = await Promise.all([this.checkFreshness(), this.checkPrices()]);
    return { freshness, bounds };
  }

  /**
   * Capability: pause a vault (agent-signed `emergencyPause`). Not auto-invoked —
   * an operator/agent calls this on a confirmed critical condition (mass-pausing
   * every vault on a transient price blip would be worse than the blip).
   */
  async pauseVault(vault: `0x${string}`, reason: string): Promise<`0x${string}`> {
    const wallet = getAgentWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_TX_ABI,
      functionName: "emergencyPause",
      args: [reason],
      chain: activeChain,
      account: wallet.account!,
    });
  }

  /**
   * Run checks and, if RISK_AUTOPAUSE_ENABLED and a token breached its floor,
   * pause every vault. Per-vault pause failures are isolated. Returns what it found/did.
   */
  async guardAndMaybePause(
    opts: RiskGuardOpts,
  ): Promise<{ critical: PriceBoundStatus[]; pausedVaults: `0x${string}`[] }> {
    const { bounds } = await this.runChecks();
    const critical = criticalBreaches(bounds);
    const pausedVaults: `0x${string}`[] = [];
    if (opts.enabled && critical.length > 0) {
      const reason = `depeg: ${critical.map((c) => `${c.symbol}:${c.reason}`).join(",")}`;
      for (const v of await opts.listVaults()) {
        try {
          await opts.pauseVault(v, reason);
          pausedVaults.push(v);
        } catch (err) {
          log.error({ vault: v, err }, "auto-pause failed for vault");
        }
      }
      log.warn({ critical: critical.length, paused: pausedVaults.length }, "auto-paused on depeg");
    }
    return { critical, pausedVaults };
  }
}

export const priceMonitorService = new PriceMonitorService();
