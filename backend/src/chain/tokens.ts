import { stringToHex } from "viem";
import { env } from "../config/env.js";

/**
 * Token registry (Mantle Sepolia mocks). See backend/INTEGRATION.md token table.
 * - `static` tokens (USDC, mUSD) are pinned to $1 on-chain → never pushed.
 * - `feedId` is the MockOracle bytes32 key the price-pusher reads from.
 */
export type TokenSymbol =
  | "USDC"
  | "mUSD"
  | "USDY"
  | "mETH"
  | "cmETH"
  | "sUSDe"
  | "WMNT";

export interface TokenMeta {
  symbol: TokenSymbol;
  address: string;
  decimals: number;
  static: boolean;
  /** MockOracle feed string; encoded to bytes32 in `feedId`. Undefined for static. */
  feed?: string;
}

export const TOKENS: Record<TokenSymbol, TokenMeta> = {
  USDC: { symbol: "USDC", address: env.USDC_ADDR, decimals: 6, static: true },
  mUSD: { symbol: "mUSD", address: env.MUSD_ADDR, decimals: 18, static: true },
  USDY: { symbol: "USDY", address: env.USDY_ADDR, decimals: 18, static: false, feed: "USDY" },
  mETH: { symbol: "mETH", address: env.METH_ADDR, decimals: 18, static: false, feed: "mETH_FUNDAMENTAL" },
  cmETH: { symbol: "cmETH", address: env.CMETH_ADDR, decimals: 18, static: false, feed: "cmETH" },
  sUSDe: { symbol: "sUSDe", address: env.SUSDE_ADDR, decimals: 18, static: false, feed: "sUSDe" },
  WMNT: { symbol: "WMNT", address: env.WMNT_ADDR, decimals: 18, static: false, feed: "MNT" },
};

/** Tokens the backend pushes prices for (everything non-static with a feed). */
export const PUSHABLE_TOKENS = Object.values(TOKENS).filter(
  (t) => !t.static && t.feed,
);

/** MockOracle bytes32 feed id for a token's feed string. */
export const feedId = (feed: string): `0x${string}` =>
  stringToHex(feed, { size: 32 });

/** Risk strategy → target allocation in bps (sums to 10000). */
export const STRATEGY: Record<
  "LOW" | "MEDIUM" | "HIGH",
  { token: TokenSymbol; bps: number }[]
> = {
  LOW: [
    { token: "mUSD", bps: 9000 },
    { token: "USDY", bps: 1000 },
  ],
  MEDIUM: [
    { token: "mUSD", bps: 4000 },
    { token: "mETH", bps: 3000 },
    { token: "cmETH", bps: 3000 },
  ],
  HIGH: [
    { token: "cmETH", bps: 4000 },
    { token: "sUSDe", bps: 3000 },
    { token: "mETH", bps: 2000 },
    { token: "WMNT", bps: 1000 },
  ],
};

/** On-chain riskPreference enum (UserVault.riskPreference uint8). */
export const RISK_LEVEL = { LOW: 0, MEDIUM: 1, HIGH: 2, CUSTOM: 3 } as const;
export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];
