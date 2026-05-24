import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle, mantleSepoliaTestnet } from "viem/chains";
import { env } from "../config/env.js";
import { as0x } from "./addresses.js";

/** Resolve the active chain from CHAIN_ID (5000 mainnet, 5003 sepolia). */
export const activeChain =
  env.CHAIN_ID === mantle.id ? mantle : mantleSepoliaTestnet;

// The public Mantle Sepolia RPC is flaky, so retry generously and fall back to a
// secondary endpoint when MANTLE_RPC_URL_FALLBACK is configured.
const httpOpts = { retryCount: 5, retryDelay: 300 } as const;
const primary = http(env.MANTLE_RPC_URL, httpOpts);
const transport = env.MANTLE_RPC_URL_FALLBACK
  ? fallback([primary, http(env.MANTLE_RPC_URL_FALLBACK, httpOpts)])
  : primary;

/** Read-only client (indexer, pricing, projections, vault reads). */
export const publicClient = createPublicClient({
  chain: activeChain,
  transport,
});

/** Mantle MAINNET read client — only for the Ondo USDY oracle (mainnet-only). */
export const mainnetPublicClient = createPublicClient({
  chain: mantle,
  transport: http(env.MANTLE_MAINNET_RPC, httpOpts),
});

/**
 * Wallet client for the AGENT_EXECUTOR EOA — signs pushPrices() and rebalance().
 * Lazy + memoized so the app boots without a key (mock mode); callers that need
 * to send a tx call this and get a clear error if the key is missing.
 */
let _agentWallet: WalletClient | undefined;
export function getAgentWallet(): WalletClient {
  if (_agentWallet) return _agentWallet;
  if (!env.PRIVATE_KEY_AGENT_EXECUTOR) {
    throw new Error(
      "PRIVATE_KEY_AGENT_EXECUTOR not set — cannot sign agent transactions",
    );
  }
  _agentWallet = createWalletClient({
    account: privateKeyToAccount(as0x(env.PRIVATE_KEY_AGENT_EXECUTOR)),
    chain: activeChain,
    transport,
  });
  return _agentWallet;
}

/** AGENT_EXECUTOR public address (safe to log / hand to the SC team for auth). */
export function agentAddress(): `0x${string}` | null {
  if (!env.PRIVATE_KEY_AGENT_EXECUTOR) return null;
  return privateKeyToAccount(as0x(env.PRIVATE_KEY_AGENT_EXECUTOR)).address;
}
