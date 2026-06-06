import { stringToHex } from "viem";
import { env } from "../config/env.js";

// ── Category & symbol types ──────────────────────────────────────────────────

export type TokenCategory =
  | "STABLE"
  | "BOND"
  | "GOLD"
  | "COMMODITY"
  | "INDEX"
  | "STOCK"
  | "CRYPTO_LST"
  | "CRYPTO"
  | "FX_MAJOR"
  | "FX_EM";

export type TokenSymbol =
  // Stablecoins / yield-stable
  | "USDC" | "mUSD" | "USDY" | "sUSDe" | "BENJI" | "BUIDL" | "VBILL"
  // Bonds / credit
  | "CETES" | "GILTS" | "KTB" | "TESOURO" | "ACRED" | "ONDO"
  // Gold & precious metals
  | "XAU" | "XAUt" | "XAG" | "XPT"
  // Commodities
  | "WTI" | "XCU" | "URANIUM"
  // Equity indices
  | "USA500" | "USA100" | "KOSPI200" | "NIKKEI225"
  // Stocks
  | "AAPL" | "AMZN" | "GOOGL" | "META" | "MSFT" | "NVDA" | "PLTR" | "TSLA"
  // Crypto LST
  | "mETH" | "cmETH"
  // Crypto
  | "WMNT"
  // FX Major
  | "EUR" | "GBP" | "SGD"
  // FX EM
  | "BRL" | "IDR" | "JPY" | "KRW" | "TRY";

export interface TokenMeta {
  symbol: TokenSymbol;
  address: string;
  decimals: number;
  category: TokenCategory;
  /** True = hardcoded $1 on-chain, no relayer push needed. */
  static: boolean;
  /** MockOracle feed bytes32 key. Undefined for static tokens. */
  feed?: string;
}

// ── Token registry ───────────────────────────────────────────────────────────

export const TOKENS: Record<TokenSymbol, TokenMeta> = {
  // ── STABLE ───────────────────────────────────────────────────────────────
  USDC:  { symbol: "USDC",  address: env.USDC_ADDR,  decimals: 6,  category: "STABLE", static: true },
  mUSD:  { symbol: "mUSD",  address: env.MUSD_ADDR,  decimals: 18, category: "STABLE", static: true },
  USDY:  { symbol: "USDY",  address: env.USDY_ADDR,  decimals: 18, category: "STABLE", static: false, feed: "USDY" },
  sUSDe: { symbol: "sUSDe", address: env.SUSDE_ADDR, decimals: 18, category: "STABLE", static: false, feed: "sUSDe" },
  BENJI: { symbol: "BENJI", address: env.BENJI_ADDR, decimals: 18, category: "STABLE", static: false, feed: "BENJI" },
  BUIDL: { symbol: "BUIDL", address: env.BUIDL_ADDR, decimals: 18, category: "STABLE", static: false, feed: "BUIDL" },
  VBILL: { symbol: "VBILL", address: env.VBILL_ADDR, decimals: 18, category: "STABLE", static: false, feed: "VBILL" },

  // ── BOND ─────────────────────────────────────────────────────────────────
  CETES:   { symbol: "CETES",   address: env.CETES_ADDR,   decimals: 18, category: "BOND", static: false, feed: "CETES" },
  GILTS:   { symbol: "GILTS",   address: env.GILTS_ADDR,   decimals: 18, category: "BOND", static: false, feed: "GILTS" },
  KTB:     { symbol: "KTB",     address: env.KTB_ADDR,     decimals: 18, category: "BOND", static: false, feed: "KTB" },
  TESOURO: { symbol: "TESOURO", address: env.TESOURO_ADDR, decimals: 18, category: "BOND", static: false, feed: "TESOURO" },
  ACRED:   { symbol: "ACRED",   address: env.ACRED_ADDR,   decimals: 18, category: "BOND", static: false, feed: "ACRED" },
  ONDO:    { symbol: "ONDO",    address: env.ONDO_ADDR,    decimals: 18, category: "BOND", static: false, feed: "ONDO" },

  // ── GOLD ─────────────────────────────────────────────────────────────────
  XAU:  { symbol: "XAU",  address: env.XAU_ADDR,  decimals: 18, category: "GOLD", static: false, feed: "XAU" },
  XAUt: { symbol: "XAUt", address: env.XAUT_ADDR, decimals: 18, category: "GOLD", static: false, feed: "XAUt" },
  XAG:  { symbol: "XAG",  address: env.XAG_ADDR,  decimals: 18, category: "GOLD", static: false, feed: "XAG" },
  XPT:  { symbol: "XPT",  address: env.XPT_ADDR,  decimals: 18, category: "GOLD", static: false, feed: "XPT" },

  // ── COMMODITY ────────────────────────────────────────────────────────────
  WTI:     { symbol: "WTI",     address: env.WTI_ADDR,     decimals: 18, category: "COMMODITY", static: false, feed: "WTI" },
  XCU:     { symbol: "XCU",     address: env.XCU_ADDR,     decimals: 18, category: "COMMODITY", static: false, feed: "XCU" },
  URANIUM: { symbol: "URANIUM", address: env.URANIUM_ADDR, decimals: 18, category: "COMMODITY", static: false, feed: "URANIUM" },

  // ── INDEX ────────────────────────────────────────────────────────────────
  USA500:    { symbol: "USA500",    address: env.USA500_ADDR,    decimals: 18, category: "INDEX", static: false, feed: "USA500" },
  USA100:    { symbol: "USA100",    address: env.USA100_ADDR,    decimals: 18, category: "INDEX", static: false, feed: "USA100" },
  KOSPI200:  { symbol: "KOSPI200",  address: env.KOSPI200_ADDR,  decimals: 18, category: "INDEX", static: false, feed: "KOSPI200" },
  NIKKEI225: { symbol: "NIKKEI225", address: env.NIKKEI225_ADDR, decimals: 18, category: "INDEX", static: false, feed: "NIKKEI225" },

  // ── STOCK ────────────────────────────────────────────────────────────────
  AAPL:  { symbol: "AAPL",  address: env.AAPL_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "AAPL" },
  AMZN:  { symbol: "AMZN",  address: env.AMZN_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "AMZN" },
  GOOGL: { symbol: "GOOGL", address: env.GOOGL_ADDR, decimals: 18, category: "STOCK", static: false, feed: "GOOGL" },
  META:  { symbol: "META",  address: env.META_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "META" },
  MSFT:  { symbol: "MSFT",  address: env.MSFT_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "MSFT" },
  NVDA:  { symbol: "NVDA",  address: env.NVDA_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "NVDA" },
  PLTR:  { symbol: "PLTR",  address: env.PLTR_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "PLTR" },
  TSLA:  { symbol: "TSLA",  address: env.TSLA_ADDR,  decimals: 18, category: "STOCK", static: false, feed: "TSLA" },

  // ── CRYPTO_LST ───────────────────────────────────────────────────────────
  mETH:  { symbol: "mETH",  address: env.METH_ADDR,  decimals: 18, category: "CRYPTO_LST", static: false, feed: "mETH_FUNDAMENTAL" },
  cmETH: { symbol: "cmETH", address: env.CMETH_ADDR, decimals: 18, category: "CRYPTO_LST", static: false, feed: "cmETH" },

  // ── CRYPTO ───────────────────────────────────────────────────────────────
  WMNT: { symbol: "WMNT", address: env.WMNT_ADDR, decimals: 18, category: "CRYPTO", static: false, feed: "MNT" },

  // ── FX_MAJOR ─────────────────────────────────────────────────────────────
  EUR: { symbol: "EUR", address: env.EUR_ADDR, decimals: 18, category: "FX_MAJOR", static: false, feed: "EUR" },
  GBP: { symbol: "GBP", address: env.GBP_ADDR, decimals: 18, category: "FX_MAJOR", static: false, feed: "GBP" },
  SGD: { symbol: "SGD", address: env.SGD_ADDR, decimals: 18, category: "FX_MAJOR", static: false, feed: "SGD" },

  // ── FX_EM ────────────────────────────────────────────────────────────────
  BRL: { symbol: "BRL", address: env.BRL_ADDR, decimals: 18, category: "FX_EM", static: false, feed: "BRL" },
  IDR: { symbol: "IDR", address: env.IDR_ADDR, decimals: 18, category: "FX_EM", static: false, feed: "IDR" },
  JPY: { symbol: "JPY", address: env.JPY_ADDR, decimals: 18, category: "FX_EM", static: false, feed: "JPY" },
  KRW: { symbol: "KRW", address: env.KRW_ADDR, decimals: 18, category: "FX_EM", static: false, feed: "KRW" },
  TRY: { symbol: "TRY", address: env.TRY_ADDR, decimals: 18, category: "FX_EM", static: false, feed: "TRY" },
};

// ── Derived helpers ──────────────────────────────────────────────────────────

/** Tokens the relayer pushes prices for (non-static with a feed key). */
export const PUSHABLE_TOKENS = Object.values(TOKENS).filter(
  (t) => !t.static && t.feed,
);

/** Look up token metadata by on-chain address (lowercase compare). */
export const TOKEN_BY_ADDRESS = Object.fromEntries(
  Object.values(TOKENS).map((t) => [t.address.toLowerCase(), t]),
) as Record<string, TokenMeta>;

/** Tokens grouped by category. */
export const TOKENS_BY_CATEGORY: Record<TokenCategory, TokenMeta[]> =
  Object.values(TOKENS).reduce(
    (acc, t) => {
      acc[t.category].push(t);
      return acc;
    },
    {
      STABLE: [], BOND: [], GOLD: [], COMMODITY: [],
      INDEX: [], STOCK: [], CRYPTO_LST: [], CRYPTO: [],
      FX_MAJOR: [], FX_EM: [],
    } as Record<TokenCategory, TokenMeta[]>,
  );

/** MockOracle bytes32 feed id for a token's feed string. */
export const feedId = (feed: string): `0x${string}` =>
  stringToHex(feed, { size: 32 });

// ── Strategy bounds ──────────────────────────────────────────────────────────

export interface CategoryBounds {
  /** Minimum category allocation in bps (0–10000). */
  minBps: number;
  /** Maximum category allocation in bps (0–10000). */
  maxBps: number;
}

/**
 * Guardrail bounds per category per risk level.
 * Hermes must keep each category's total allocation within these bounds.
 * All min values across categories sum < 10000 (leaves room for Hermes to decide).
 */
export const CATEGORY_BOUNDS: Record<
  TokenCategory,
  Record<"LOW" | "MEDIUM" | "HIGH", CategoryBounds>
> = {
  //              LOW                    MEDIUM                 HIGH
  STABLE:     { LOW: { minBps: 6500, maxBps: 9000 }, MEDIUM: { minBps: 2500, maxBps: 5000 }, HIGH: { minBps:  500, maxBps: 2000 } },
  BOND:       { LOW: { minBps:  500, maxBps: 2500 }, MEDIUM: { minBps:  500, maxBps: 2000 }, HIGH: { minBps:    0, maxBps: 1000 } },
  GOLD:       { LOW: { minBps:    0, maxBps: 1000 }, MEDIUM: { minBps:    0, maxBps: 1500 }, HIGH: { minBps:    0, maxBps: 1000 } },
  COMMODITY:  { LOW: { minBps:    0, maxBps:    0 }, MEDIUM: { minBps:    0, maxBps:  800 }, HIGH: { minBps:    0, maxBps: 1500 } },
  INDEX:      { LOW: { minBps:    0, maxBps:    0 }, MEDIUM: { minBps:  500, maxBps: 2000 }, HIGH: { minBps: 1000, maxBps: 2500 } },
  STOCK:      { LOW: { minBps:    0, maxBps:  500 }, MEDIUM: { minBps:  500, maxBps: 2000 }, HIGH: { minBps: 1500, maxBps: 3500 } },
  CRYPTO_LST: { LOW: { minBps:    0, maxBps:  500 }, MEDIUM: { minBps:  500, maxBps: 1500 }, HIGH: { minBps: 1000, maxBps: 2500 } },
  CRYPTO:     { LOW: { minBps:    0, maxBps:  300 }, MEDIUM: { minBps:  200, maxBps:  800 }, HIGH: { minBps:  300, maxBps: 1500 } },
  FX_MAJOR:   { LOW: { minBps:    0, maxBps:  500 }, MEDIUM: { minBps:    0, maxBps:  800 }, HIGH: { minBps:    0, maxBps:  800 } },
  FX_EM:      { LOW: { minBps:    0, maxBps:    0 }, MEDIUM: { minBps:    0, maxBps:  500 }, HIGH: { minBps:    0, maxBps:  800 } },
};

/**
 * Per-token maximum allocation in bps, regardless of category total.
 * Undefined = uncapped (stablecoins, bonds — category bound is enough).
 */
export const PER_TOKEN_CAP_BPS: Partial<
  Record<TokenCategory, Record<"LOW" | "MEDIUM" | "HIGH", number>>
> = {
  STOCK:      { LOW:  800, MEDIUM:  800, HIGH:  800 },
  INDEX:      { LOW: 1500, MEDIUM: 1500, HIGH: 1500 },
  COMMODITY:  { LOW: 1000, MEDIUM: 1000, HIGH: 1000 },
  FX_MAJOR:   { LOW:  500, MEDIUM:  500, HIGH:  500 },
  FX_EM:      { LOW:  500, MEDIUM:  500, HIGH:  500 },
  CRYPTO_LST: { LOW: 2000, MEDIUM: 3000, HIGH: 3000 },
  CRYPTO:     { LOW: 2000, MEDIUM: 3000, HIGH: 3000 },
};

// ── Deterministic fallback strategy ─────────────────────────────────────────
// Used when the LLM rebalancer is unavailable. Sums to exactly 10000 bps.

export const STRATEGY: Record<
  "LOW" | "MEDIUM" | "HIGH",
  { token: TokenSymbol; bps: number }[]
> = {
  LOW: [
    { token: "mUSD",    bps: 6000 },
    { token: "sUSDe",   bps: 1000 },
    { token: "USDY",    bps: 1000 },
    { token: "VBILL",   bps:  500 },
    { token: "CETES",   bps:  500 },
    { token: "GILTS",   bps:  500 },
    { token: "TESOURO", bps:  500 },
  ],
  MEDIUM: [
    { token: "mUSD",    bps: 2500 },
    { token: "sUSDe",   bps: 1000 },
    { token: "CETES",   bps: 1000 },
    { token: "GILTS",   bps:  500 },
    { token: "XAU",     bps:  500 },
    { token: "USA500",  bps: 1000 },
    { token: "AAPL",    bps:  500 },
    { token: "MSFT",    bps:  500 },
    { token: "mETH",    bps: 1000 },
    { token: "cmETH",   bps:  500 },
    { token: "WMNT",    bps:  500 },
    { token: "EUR",     bps:  500 },
  ],
  HIGH: [
    { token: "sUSDe",   bps: 1200 },
    { token: "CETES",   bps:  500 },
    { token: "XAG",     bps:  500 },
    { token: "WTI",     bps:  500 },
    { token: "USA500",  bps: 1500 },
    { token: "NVDA",    bps:  800 },
    { token: "TSLA",    bps:  800 },
    { token: "META",    bps:  600 },
    { token: "MSFT",    bps:  600 },
    { token: "mETH",    bps: 1200 },
    { token: "cmETH",   bps: 1100 },
    { token: "WMNT",    bps:  700 },
  ],
};

// ── Risk level enum (mirrors UserVault.RiskLevel uint8) ──────────────────────

export const RISK_LEVEL = { LOW: 0, MEDIUM: 1, HIGH: 2, CUSTOM: 3 } as const;
export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];
