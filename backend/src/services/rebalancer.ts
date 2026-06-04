import { childLogger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { publicClient, getAgentWallet, agentAddress, activeChain } from "../chain/index.js";
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
  clampTargetToCaps,
  driftFloorWad,
  valueUsd,
  type SwapInstruction,
  type TokenState,
} from "./rebalance-math.js";
import {
  getAgentConfig,
  DEFAULT_AGENT_CONFIG,
  type AgentConfigValue,
} from "./agent-config.js";

/** The guardrails buildInstructions honours (subset of the agent config). */
export type Guardrails = Pick<
  AgentConfigValue,
  "perTokenCapsBps" | "driftThresholdBps" | "maxSlippageBps"
>;

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
  | { action: "skip"; reason: "paused" | "disabled" | "cooldown" | "balanced" | "unsafe" | "stale" }
  | { action: "rebalanced"; hash: `0x${string}`; swaps: number };

// Injectable dependencies (faked in tests).
export interface RebalancerDeps {
  listVaults: () => Promise<`0x${string}`[]>;
  readVaultMeta: (vault: `0x${string}`) => Promise<VaultMeta>;
  /** Are all pushable token feeds fresh (≤ PriceFeed.maxStaleness)? Gates rebalancing
   *  so we never plan/trade on a stale price (and buildInstructions' getPrice never reverts). */
  arePricesFresh: () => Promise<boolean>;
  /** Off-chain agent guardrails (pause, cadence, caps, drift, slippage). */
  readAgentConfig: (vault: `0x${string}`) => Promise<AgentConfigValue>;
  buildInstructions: (
    vault: `0x${string}`,
    risk: number,
    guardrails?: Guardrails,
  ) => Promise<SwapInstruction[]>;
  /** Dry-run the rebalance (eth_call) — true if it would succeed, false if it'd revert. */
  simulateRebalance: (
    vault: `0x${string}`,
    instructions: SwapInstruction[],
  ) => Promise<boolean>;
  sendRebalance: (
    vault: `0x${string}`,
    instructions: SwapInstruction[],
  ) => Promise<`0x${string}`>;
  now: () => bigint;
}

/** Read a vault's current token balances + PriceFeed prices, then plan swaps,
 *  honouring the agent guardrails (per-token caps, drift threshold, slippage). */
export async function defaultBuildInstructions(
  vault: `0x${string}`,
  risk: number,
  guardrails: Guardrails = DEFAULT_AGENT_CONFIG,
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

  let targetBps = resolveTargetBps(risk as 0 | 1 | 2 | 3, custom);
  if (guardrails.perTokenCapsBps) {
    targetBps = clampTargetToCaps(targetBps, guardrails.perTokenCapsBps);
  }

  // drift threshold raises the dust floor: only act if drift exceeds X% of portfolio
  let minSwap = MIN_SWAP_USD;
  if (guardrails.driftThresholdBps != null) {
    const totalWad = states.reduce((sum, t) => sum + valueUsd(t), 0n);
    const floor = driftFloorWad(guardrails.driftThresholdBps, totalWad);
    if (floor > minSwap) minSwap = floor;
  }

  return computeSwapInstructions(states, targetBps, {
    slippageBps: guardrails.maxSlippageBps ?? SLIPPAGE_BPS,
    minSwapValueUsd: minSwap,
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
  async arePricesFresh() {
    if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) return true;
    const pf = { address: as0x(addresses.priceFeed), abi: PRICE_FEED_ABI } as const;
    const [block, maxStaleness] = await Promise.all([
      publicClient.getBlock(),
      publicClient.readContract({ ...pf, functionName: "maxStaleness" }),
    ]);
    for (const t of Object.values(TOKENS)) {
      if (t.static || !t.feed || !t.address) continue;
      const [, updatedAt] = await publicClient.readContract({
        ...pf,
        functionName: "getPriceUnsafe",
        args: [as0x(t.address)],
      });
      if (updatedAt === 0n || block.timestamp - updatedAt > maxStaleness) return false;
    }
    return true;
  },
  readAgentConfig: getAgentConfig,
  buildInstructions: defaultBuildInstructions,
  async simulateRebalance(vault, instructions) {
    const account = agentAddress();
    if (!account) return true; // no agent configured (mock) — let send path handle it
    try {
      await publicClient.simulateContract({
        address: vault,
        abi: USER_VAULT_ABI,
        functionName: "rebalance",
        args: [instructions],
        account,
      });
      return true;
    } catch {
      return false; // would revert on-chain → caller skips instead of burning gas
    }
  },
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
    const [meta, config] = await Promise.all([
      this.deps.readVaultMeta(vault),
      this.deps.readAgentConfig(vault),
    ]);

    if (meta.paused) {
      log.info({ vault }, "paused (on-chain), skip");
      return { action: "skip", reason: "paused" };
    }
    if (!config.autoRebalanceEnabled) {
      log.info({ vault }, "auto-rebalance disabled by user, skip");
      return { action: "skip", reason: "disabled" };
    }
    const now = this.deps.now();
    if (now < meta.lastRebalanceTime + meta.minRebalanceInterval) {
      log.info({ vault }, "on-chain cooldown not elapsed, skip");
      return { action: "skip", reason: "cooldown" };
    }
    if (config.cadenceSec != null && now < meta.lastRebalanceTime + BigInt(config.cadenceSec)) {
      log.info({ vault }, "off-chain cadence not elapsed, skip");
      return { action: "skip", reason: "cooldown" };
    }
    if (!(await this.deps.arePricesFresh())) {
      log.warn({ vault }, "price feeds stale — skip (won't plan/trade on stale prices)");
      return { action: "skip", reason: "stale" };
    }

    const instructions = await this.deps.buildInstructions(
      vault,
      meta.riskPreference,
      config,
    );
    if (instructions.length === 0) {
      log.info({ vault }, "already balanced, skip");
      return { action: "skip", reason: "balanced" };
    }
    if (!(await this.deps.simulateRebalance(vault, instructions))) {
      log.warn({ vault, swaps: instructions.length }, "rebalance would revert (sim), skip — no gas spent");
      return { action: "skip", reason: "unsafe" };
    }

    const hash = await this.deps.sendRebalance(vault, instructions);
    log.info({ vault, hash, swaps: instructions.length }, "rebalanced");
    return { action: "rebalanced", hash, swaps: instructions.length };
  }

  /**
   * Manual "run now" for one vault (the FE Agent page button). Bypasses the
   * auto-rebalance toggle + cadence/cooldown (the user explicitly asked) but still
   * respects on-chain pause + the guardrails (caps/slippage/drift). No-op if balanced.
   */
  async runNow(vault: `0x${string}`): Promise<VaultOutcome> {
    const [meta, config] = await Promise.all([
      this.deps.readVaultMeta(vault),
      this.deps.readAgentConfig(vault),
    ]);
    if (meta.paused) return { action: "skip", reason: "paused" };
    if (!(await this.deps.arePricesFresh())) {
      log.warn({ vault }, "manual rebalance: price feeds stale, skip");
      return { action: "skip", reason: "stale" };
    }
    const instructions = await this.deps.buildInstructions(vault, meta.riskPreference, config);
    if (instructions.length === 0) return { action: "skip", reason: "balanced" };
    if (!(await this.deps.simulateRebalance(vault, instructions))) {
      log.warn({ vault }, "manual rebalance would revert (sim), skip");
      return { action: "skip", reason: "unsafe" };
    }
    const hash = await this.deps.sendRebalance(vault, instructions);
    log.info({ vault, hash, swaps: instructions.length }, "manual rebalance");
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
