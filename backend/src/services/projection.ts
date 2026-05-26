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
 * Baseline per-token APY (%) estimates. NOT live protocol rates — overridable via
 * APY_PCT_JSON; real APY (Ondo/Mantle-LSP/Ethena oracles) is a follow-up.
 */
export const DEFAULT_APY_PCT: ApyByToken = {
  USDC: 0,
  mUSD: 5,
  USDY: 5,
  mETH: 3.5,
  cmETH: 4,
  sUSDe: 12,
  WMNT: 0,
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
