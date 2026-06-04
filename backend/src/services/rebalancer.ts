import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { publicClient, getAgentWallet, activeChain } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import {
  USER_VAULT_ABI,
  VAULT_FACTORY_ABI,
  PRICE_FEED_ABI,
  ERC20_ABI,
} from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";
import {
  computeSwapInstructions,
  resolveTargetBps,
  type SwapInstruction,
  type TokenState,
} from "./rebalance-math.js";

const log = childLogger("rebalancer");

export type { SwapInstruction } from "./rebalance-math.js";

/** Vault default slippage tolerance (maxSlippageBps) and a $1 dust floor. */
export const SLIPPAGE_BPS = 100;
export const MIN_SWAP_USD = 10n ** 18n; // $1 in 18-dec USD

export interface VaultMeta {
  paused: boolean;
  lastRebalanceTime: bigint;
  minRebalanceInterval: bigint;
  riskPreference: number;
}

/** Why a vault was skipped (or that it was rebalanced) — surfaced for tests/telemetry. */
export type VaultOutcome =
  | { action: "skip"; reason: "paused" | "cooldown" | "balanced" }
  | { action: "rebalanced"; hash: `0x${string}`; swaps: number };

// Injectable dependencies (faked in tests).
export interface RebalancerDeps {
  listVaults: () => Promise<`0x${string}`[]>;
  readVaultMeta: (vault: `0x${string}`) => Promise<VaultMeta>;
  buildInstructions: (
    vault: `0x${string}`,
    risk: number,
  ) => Promise<SwapInstruction[]>;
  sendRebalance: (
    vault: `0x${string}`,
    instructions: SwapInstruction[],
  ) => Promise<`0x${string}`>;
  now: () => bigint;
}

/** Read a vault's current token balances + PriceFeed prices, then plan swaps. */
export async function defaultBuildInstructions(
  vault: `0x${string}`,
  risk: number,
): Promise<SwapInstruction[]> {
  const tokenList = Object.values(TOKENS).filter((t) => t.address);

  const states: TokenState[] = await Promise.all(
    tokenList.map(async (t) => {
      const [balance, price] = await Promise.all([
        publicClient.readContract({
          address: as0x(t.address),
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [vault],
        }),
        publicClient.readContract({
          address: as0x(addresses.priceFeed),
          abi: PRICE_FEED_ABI,
          functionName: "getPrice",
          args: [as0x(t.address)],
        }),
      ]);
      return {
        symbol: t.symbol,
        address: as0x(t.address),
        decimals: t.decimals,
        balance,
        price,
      };
    }),
  );

  let custom;
  if (risk === 3) {
    const [lowBps, medBps, highBps] = await publicClient.readContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: "customAllocation",
    });
    custom = { lowBps, medBps, highBps };
  }

  const targetBps = resolveTargetBps(risk as 0 | 1 | 2 | 3, custom);
  return computeSwapInstructions(states, targetBps, {
    slippageBps: SLIPPAGE_BPS,
    minSwapValueUsd: MIN_SWAP_USD,
  });
}

export const defaultRebalancerDeps: RebalancerDeps = {
  async listVaults() {
    if (env.USE_MOCK_CONTRACTS || !addresses.vaultFactory) {
      log.warn("vault factory not configured (mock mode)");
      return [];
    }
    const factory = {
      address: as0x(addresses.vaultFactory),
      abi: VAULT_FACTORY_ABI,
    } as const;
    const total = await publicClient.readContract({
      ...factory,
      functionName: "totalVaults",
    });
    const vaults: `0x${string}`[] = [];
    for (let i = 0n; i < total; i++) {
      vaults.push(
        await publicClient.readContract({
          ...factory,
          functionName: "allVaults",
          args: [i],
        }),
      );
    }
    return vaults;
  },
  async readVaultMeta(vault) {
    const base = { address: vault, abi: USER_VAULT_ABI } as const;
    const [paused, lastRebalanceTime, minRebalanceInterval, riskPreference] =
      await Promise.all([
        publicClient.readContract({ ...base, functionName: "paused" }),
        publicClient.readContract({ ...base, functionName: "lastRebalanceTime" }),
        publicClient.readContract({ ...base, functionName: "minRebalanceInterval" }),
        publicClient.readContract({ ...base, functionName: "riskPreference" }),
      ]);
    return { paused, lastRebalanceTime, minRebalanceInterval, riskPreference };
  },
  buildInstructions: defaultBuildInstructions,
  async sendRebalance(vault, instructions) {
    const wallet = getAgentWallet();
    return wallet.writeContract({
      address: vault,
      abi: USER_VAULT_ABI,
      functionName: "rebalance",
      args: [instructions],
      chain: activeChain,
      account: wallet.account!,
    });
  },
  now: () => BigInt(Math.floor(Date.now() / 1000)),
};

/**
 * Backend rebalance agent (Hermes) — backend/INTEGRATION.md §2.
 * Loops every UserVault: read risk preference + balances, compute target
 * allocation, build SwapInstruction[] off-chain, then call vault.rebalance().
 */
export class RebalancerService {
  constructor(private readonly deps: RebalancerDeps = defaultRebalancerDeps) {}

  listVaults(): Promise<`0x${string}`[]> {
    return this.deps.listVaults();
  }

  /** Decide + (maybe) execute a rebalance for one vault. */
  async processVault(vault: `0x${string}`): Promise<VaultOutcome> {
    const meta = await this.deps.readVaultMeta(vault);

    if (meta.paused) {
      log.info({ vault }, "paused, skip");
      return { action: "skip", reason: "paused" };
    }
    if (this.deps.now() < meta.lastRebalanceTime + meta.minRebalanceInterval) {
      log.info({ vault }, "cooldown not elapsed, skip");
      return { action: "skip", reason: "cooldown" };
    }

    const instructions = await this.deps.buildInstructions(
      vault,
      meta.riskPreference,
    );
    if (instructions.length === 0) {
      log.info({ vault }, "already balanced, skip");
      return { action: "skip", reason: "balanced" };
    }

    const hash = await this.deps.sendRebalance(vault, instructions);
    log.info({ vault, hash, swaps: instructions.length }, "rebalanced");
    return { action: "rebalanced", hash, swaps: instructions.length };
  }

  /** Run a full pass over all vaults, isolating per-vault failures. */
  async runOnce(): Promise<void> {
    const vaults = await this.deps.listVaults();
    for (const v of vaults) {
      try {
        await this.processVault(v);
      } catch (err) {
        log.error({ vault: v, err }, "rebalance failed");
      }
    }
  }

  /** Exposed for callers/tests that want just the plan. */
  buildSwapInstructions(
    vault: `0x${string}`,
    risk: number,
  ): Promise<SwapInstruction[]> {
    return this.deps.buildInstructions(vault, risk);
  }
}

export const rebalancerService = new RebalancerService();
