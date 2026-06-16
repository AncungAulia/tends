import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type Chain,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantle, mantleSepoliaTestnet } from "viem/chains";
import { env } from "../config/env.js";
import { as0x } from "./addresses.js";

// Canonical Multicall3 — deployed at the same address on every chain (verified
// on-chain on Mantle Sepolia). viem's mantleSepoliaTestnet def omits it, so add it
// here to enable read batching (Promise.all reads coalesce into one aggregate call).
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const withMulticall3 = (chain: Chain): Chain =>
  chain.contracts?.multicall3
    ? chain
    : { ...chain, contracts: { ...chain.contracts, multicall3: { address: MULTICALL3 } } };

/** Resolve the active chain from CHAIN_ID (5000 mainnet, 5003 sepolia). */
export const activeChain = withMulticall3(
  env.CHAIN_ID === mantle.id ? mantle : mantleSepoliaTestnet,
);

// Public Mantle Sepolia RPCs throttle ("Too many request"), so spread load across
// every configured + known-good endpoint. fallback() fails over to the next endpoint
// on error (incl. a 429), and reads are batched via Multicall3 below to cut volume.
// (No `rank` — its background ranking timer would keep the test process alive.)
const httpOpts = { retryCount: 5, retryDelay: 300 } as const;
const rpcUrls = [
  env.MANTLE_RPC_URL,
  env.MANTLE_RPC_URL_FALLBACK,
  // extra public fallback (verified live) — sepolia only
  env.CHAIN_ID === mantle.id ? undefined : "https://mantle-sepolia.gateway.tenderly.co",
].filter((u): u is string => !!u);
const uniqueUrls = [...new Set(rpcUrls)];
const transport =
  uniqueUrls.length > 1
    ? fallback(uniqueUrls.map((u) => http(u, httpOpts)))
    : http(uniqueUrls[0], httpOpts);

/** Read-only client. Batches concurrent reads via Multicall3 to cut RPC request volume. */
export const publicClient = createPublicClient({
  chain: activeChain,
  transport,
  batch: { multicall: { wait: 16 } },
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
