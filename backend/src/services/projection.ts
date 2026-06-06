import {
  resolveTargetBps,
  type CustomAllocation,
} from "./rebalance-math.js";
import { TOKENS, type RiskLevel, type TokenSymbol } from "../chain/tokens.js";
import { env } from "../config/env.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("projection");

export interface Projection {
  capital: number;
  durationDays: number;
  blendedApyPct: number;
  base: number;
  best: number;
  worst: number;
}

export type ApyByToken = Partial<Record<TokenSymbol, number>>;

/**
 * Baseline per-token APY (%) estimates — the FALLBACK when live protocol rates
 * (ApyService.fetchLiveApy) are unavailable. Overridable via APY_PCT_JSON.
 *
 * Tuned so the blended strategy APYs come out LOW < MEDIUM < HIGH (the risk
 * ladder), given the STRATEGY allocations in chain/tokens.ts:
 *   LOW  = 60% mUSD + 10% sUSDe + 10% USDY + 5% VBILL + 5% CETES + 5% GILTS + 5% TESOURO → ~5.85%
 *   MED  = 25% mUSD + 10% sUSDe + 10% CETES + 5% GILTS + 5% XAU + 10% USA500 + 5% AAPL + 5% MSFT + 10% mETH + 5% cmETH + 5% WMNT + 5% EUR → ~6.45%
 *   HIGH = 12% sUSDe + 5% CETES + 5% XAG + 5% WTI + 15% USA500 + 8% NVDA + 8% TSLA + 6% META + 6% MSFT + 12% mETH + 11% cmETH + 7% WMNT → ~9.19%
 */
export const DEFAULT_APY_PCT: ApyByToken = {
  // Stablecoins / yield-stable
  USDC: 0,    // base asset, idle → no yield
  mUSD: 4.5,  // Mantle USD (RWA-backed stable)
  USDY: 5,    // Ondo USDY (tokenized US Treasuries)
  sUSDe: 14,  // Ethena sUSDe (staked USDe funding-rate yield; variable)
  BENJI: 5,   // Franklin Templeton money-market fund
  BUIDL: 5,   // BlackRock tokenized money-market
  VBILL: 5,   // tokenized T-bill fund
  // Bonds / credit
  CETES: 9.5, // Mexican 28-day T-bill yield
  GILTS: 4.5, // UK gilt yield
  KTB: 3,     // Korean treasury bond
  TESOURO: 6, // Brazilian Tesouro Direto
  ACRED: 6,   // credit fund
  ONDO: 5,    // Ondo tokenized yield
  // Gold & metals, commodities — no current income; price appreciation only
  XAU: 0, XAUt: 0, XAG: 0, XPT: 0,
  WTI: 0, XCU: 0, URANIUM: 0,
  // Equity indices — long-run price appreciation estimate
  USA500: 8, USA100: 10, KOSPI200: 7, NIKKEI225: 6,
  // Stocks — conservative annual return estimate
  AAPL: 8, AMZN: 10, GOOGL: 9, META: 12, MSFT: 10, NVDA: 20, PLTR: 15, TSLA: 15,
  // Crypto LST
  mETH: 4,   // Mantle ETH liquid staking
  cmETH: 8,  // Mantle cmETH (staking + restaking rewards)
  // Crypto
  WMNT: 5,   // MNT staking yield
  // FX — no yield in this context
  EUR: 0, GBP: 0, SGD: 0,
  BRL: 0, IDR: 0, JPY: 0, KRW: 0, TRY: 0,
};

/** Parse APY_PCT_JSON, keeping only known tokens with numeric values. Pure. */
export function parseApyOverrides(json: string): ApyByToken {
  if (!json) return {};
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const out: ApyByToken = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "number" && Number.isFinite(v) && k in TOKENS) {
        out[k as TokenSymbol] = v;
      }
    }
    return out;
  } catch {
    log.warn("APY_PCT_JSON is not valid JSON — ignoring");
    return {};
  }
}

let _apy: ApyByToken | undefined;
/** Effective APY estimate = defaults merged with APY_PCT_JSON overrides (memoized). */
export function currentApy(): ApyByToken {
  return (_apy ??= { ...DEFAULT_APY_PCT, ...parseApyOverrides(env.APY_PCT_JSON) });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Weighted APY (%) for a target allocation (bps) given per-token APYs (%). */
export function blendedApy(
  targetBps: Map<TokenSymbol, number>,
  apyByToken: ApyByToken,
): number {
  let sum = 0;
  for (const [token, bps] of targetBps) {
    sum += (apyByToken[token] ?? 0) * (bps / 10_000);
  }
  return sum;
}

/**
 * Compound `capital` at `blendedApyPct` over `durationDays` (daily compounding),
 * with optimistic (+25% APY) and conservative (−25% APY, −1% for fees/slippage)
 * bands. Mirrors docs/03 §C.3.
 */
export function computeProjection(
  capital: number,
  durationDays: number,
  blendedApyPct: number,
): Projection {
  const grow = (apyPct: number) =>
    capital * (1 + apyPct / 100) ** (durationDays / 365);
  return {
    capital,
    durationDays,
    blendedApyPct: round2(blendedApyPct),
    base: round2(grow(blendedApyPct)),
    best: round2(grow(blendedApyPct * 1.25)),
    worst: round2(grow(blendedApyPct * 0.75) * 0.99),
  };
}

/** End-to-end projection for a risk preset (or CUSTOM blend). */
export function projectForRisk(
  risk: RiskLevel,
  capital: number,
  durationDays: number,
  apyByToken: ApyByToken = currentApy(),
  custom?: CustomAllocation,
): Projection {
  const target = resolveTargetBps(risk, custom);
  return computeProjection(capital, durationDays, blendedApy(target, apyByToken));
}
