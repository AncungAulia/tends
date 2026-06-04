import { env } from "../config/env.js";

/**
 * Core contract addresses (per-user-vault architecture; see backend/INTEGRATION.md).
 * Real values come from smart-contract/deployments/mantle-sepolia.json once Axel
 * deploys. Until then they're empty and USE_MOCK_CONTRACTS=true — services must
 * branch on `env.USE_MOCK_CONTRACTS` before making on-chain calls.
 *
 * MockOracle is already live on Mantle Sepolia (has a default address).
 */
export const addresses = {
  vaultFactory: env.VAULT_FACTORY_ADDRESS,
  priceFeed: env.PRICE_FEED_ADDRESS,
  activityLog: env.ACTIVITY_LOG_ADDRESS,
  strategyRouter: env.STRATEGY_ROUTER_ADDRESS,
  mockOracle: env.MOCK_ORACLE_ADDRESS,
} as const;

/** True once the core contracts we need are configured (deploy has happened). */
export const coreContractsReady = (): boolean =>
  !env.USE_MOCK_CONTRACTS &&
  Boolean(addresses.vaultFactory && addresses.priceFeed && addresses.activityLog);

export const as0x = (a: string): `0x${string}` => a as `0x${string}`;
