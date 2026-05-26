import { Prisma } from "@prisma/client";
import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { VAULT_FACTORY_ABI, ACTIVITY_LOG_ABI, USER_VAULT_ABI } from "../chain/abis.js";
import { wsHub, type WsEvent } from "../ws/hub.js";
import { rebalancerService } from "./rebalancer.js";

const log = childLogger("indexer");

/** Default deposit hook: rebalance the vault now (processVault respects cooldown/pause/balanced). */
async function defaultTriggerRebalance(vault: `0x${string}`): Promise<void> {
  await rebalancerService.processVault(vault);
}

export interface VaultRecord {
  address: string;
  owner: string;
  deployedBlock: bigint | null;
}

export interface ActivityRecord {
  vaultAddress: string;
  action: string;
  metadata: Record<string, unknown>;
  txHash: string | null;
  blockNumber: bigint | null;
  agentAddress: string;
  timestamp: Date;
}

// ── Pure event/data → record mappers ─────────────────────────────────────────

/** VaultFactory `VaultDeployed(user, vault)` → a Vault upsert record. */
export function toVaultRecord(
  user: string,
  vault: string,
  blockNumber: bigint | null,
): VaultRecord {
  return { address: vault, owner: user, deployedBlock: blockNumber };
}

/** UserVault `Rebalanced(timestamp, agent, instructions)` → an AgentActivity record. */
export function toRebalanceActivity(args: {
  vault: string;
  agent: string;
  timestampSec: bigint;
  swaps: number;
  txHash: string | null;
  blockNumber: bigint | null;
}): ActivityRecord {
  return {
    vaultAddress: args.vault,
    action: "REBALANCE",
    metadata: { swaps: args.swaps },
    txHash: args.txHash,
    blockNumber: args.blockNumber,
    agentAddress: args.agent,
    timestamp: new Date(Number(args.timestampSec) * 1000),
  };
}

/** AgentActivityLog `ActivityLogged(id, vault, agent, action, timestamp)` → record. */
export function toActivityLogRecord(args: {
  vault: string;
  agent: string;
  action: string;
  timestampSec: bigint;
  txHash: string | null;
  blockNumber: bigint | null;
}): ActivityRecord {
  return {
    vaultAddress: args.vault,
    action: args.action,
    metadata: {},
    txHash: args.txHash,
    blockNumber: args.blockNumber,
    agentAddress: args.agent,
    timestamp: new Date(Number(args.timestampSec) * 1000),
  };
}

export interface RiskUpdate {
  riskPreference: number; // 0=LOW 1=MED 2=HIGH 3=CUSTOM
  lowBps: number | null;
  medBps: number | null;
  highBps: number | null;
}

/** RiskPreferenceUpdated(level, low, med, high) → DB update. Custom bps kept only for CUSTOM. */
export function toRiskUpdate(
  level: number,
  lowBps: number,
  medBps: number,
  highBps: number,
): RiskUpdate {
  const isCustom = level === 3; // RiskLevel.CUSTOM
  return {
    riskPreference: level,
    lowBps: isCustom ? lowBps : null,
    medBps: isCustom ? medBps : null,
    highBps: isCustom ? highBps : null,
  };
}

// ── Repo (injectable; default Prisma-backed) ─────────────────────────────────

export interface IndexerRepo {
  upsertVault(rec: VaultRecord): Promise<void>;
  recordActivity(rec: ActivityRecord): Promise<void>;
  /** Deposit: add shares + cost basis (upserts the vault row if missing). */
  addToPosition(vault: string, owner: string, shares: bigint, assets: bigint): Promise<void>;
  /** Withdraw: reduce shares. */
  subFromPosition(vault: string, shares: bigint): Promise<void>;
  setRiskPreference(vault: string, update: RiskUpdate): Promise<void>;
}

export const prismaIndexerRepo: IndexerRepo = {
  async upsertVault(rec) {
    await prisma.vault.upsert({
      where: { address: rec.address },
      create: { address: rec.address, owner: rec.owner, deployedBlock: rec.deployedBlock },
      update: { deployedBlock: rec.deployedBlock },
    });
  },
  async recordActivity(rec) {
    await prisma.agentActivity.create({
      data: { ...rec, metadata: rec.metadata as Prisma.InputJsonValue },
    });
  },
  async addToPosition(vault, owner, shares, assets) {
    await prisma.vault.upsert({
      where: { address: vault },
      create: {
        address: vault,
        owner,
        shares: shares.toString(),
        initialDeposit: assets.toString(),
      },
      update: {
        shares: { increment: shares.toString() },
        initialDeposit: { increment: assets.toString() },
      },
    });
  },
  async subFromPosition(vault, shares) {
    await prisma.vault.update({
      where: { address: vault },
      data: { shares: { decrement: shares.toString() } },
    });
  },
  async setRiskPreference(vault, update) {
    await prisma.vault.update({
      where: { address: vault },
      data: {
        riskPreference: update.riskPreference,
        lowBps: update.lowBps,
        medBps: update.medBps,
        highBps: update.highBps,
      },
    });
  },
};

/**
 * Indexer (per-user-vault model; backend/INTEGRATION.md §4). Event handlers are
 * pure-mapper + repo-write so they unit-test without a chain or DB; the
 * watchContractEvent wiring (startWatching) is thin glue over publicClient.
 */
export class IndexerService {
  constructor(
    private readonly repo: IndexerRepo = prismaIndexerRepo,
    private readonly broadcast: (e: WsEvent) => void = (e) => wsHub.broadcast(e),
    // event-driven: deploy a fresh deposit immediately instead of waiting for the poll
    private readonly triggerRebalance: (vault: `0x${string}`) => Promise<void> = defaultTriggerRebalance,
  ) {}

  async onVaultDeployed(user: string, vault: string, blockNumber: bigint | null): Promise<void> {
    await this.repo.upsertVault(toVaultRecord(user, vault, blockNumber));
    this.broadcast({ type: "vault_deployed", user, vault });
    log.info({ user, vault }, "vault deployed");
  }

  async onRebalanced(args: {
    vault: string;
    agent: string;
    timestampSec: bigint;
    swaps: number;
    txHash: string | null;
    blockNumber: bigint | null;
  }): Promise<void> {
    await this.repo.recordActivity(toRebalanceActivity(args));
    this.broadcast({ type: "rebalanced", vault: args.vault, swaps: args.swaps });
    log.info({ vault: args.vault, swaps: args.swaps }, "rebalance indexed");
  }

  async onActivityLogged(args: {
    vault: string;
    agent: string;
    action: string;
    timestampSec: bigint;
    txHash: string | null;
    blockNumber: bigint | null;
  }): Promise<void> {
    await this.repo.recordActivity(toActivityLogRecord(args));
    this.broadcast({ type: "activity", vault: args.vault, action: args.action });
    log.info({ vault: args.vault, action: args.action }, "activity indexed");
  }

  async onDeposit(vault: string, owner: string, assets: bigint, shares: bigint): Promise<void> {
    await this.repo.addToPosition(vault, owner, shares, assets);
    this.broadcast({ type: "deposit", vault, owner });
    log.info({ vault, owner }, "deposit indexed");
    // deploy the new funds right away (best-effort — never breaks indexing)
    await this.triggerRebalance(vault as `0x${string}`).catch((err) =>
      log.warn({ vault, err }, "deposit-triggered rebalance failed"),
    );
  }

  async onWithdraw(vault: string, owner: string, assets: bigint, shares: bigint): Promise<void> {
    await this.repo.subFromPosition(vault, shares);
    this.broadcast({ type: "withdraw", vault, owner });
    log.info({ vault, owner }, "withdraw indexed");
  }

  async onRiskPreferenceUpdated(
    vault: string,
    level: number,
    lowBps: number,
    medBps: number,
    highBps: number,
  ): Promise<void> {
    await this.repo.setRiskPreference(vault, toRiskUpdate(level, lowBps, medBps, highBps));
    this.broadcast({ type: "risk_updated", vault, level });
    log.info({ vault, level }, "risk preference indexed");
  }

  /** Enumerate all vault addresses from the factory. */
  private async listVaults(): Promise<`0x${string}`[]> {
    const factory = { address: as0x(addresses.vaultFactory), abi: VAULT_FACTORY_ABI } as const;
    const total = await publicClient.readContract({ ...factory, functionName: "totalVaults" });
    const vaults: `0x${string}`[] = [];
    for (let i = 0n; i < total; i++) {
      vaults.push(
        await publicClient.readContract({ ...factory, functionName: "allVaults", args: [i] }),
      );
    }
    return vaults;
  }

  /** Attach Deposit / Withdraw / RiskPreferenceUpdated watchers for one vault. */
  private watchVault(vault: `0x${string}`, unwatch: (() => void)[]): void {
    const base = { address: vault, abi: USER_VAULT_ABI } as const;
    unwatch.push(
      publicClient.watchContractEvent({
        ...base,
        eventName: "Deposit",
        onLogs: (logs) => {
          for (const l of logs)
            if (l.args.owner && l.args.assets !== undefined && l.args.shares !== undefined)
              void this.onDeposit(vault, l.args.owner, l.args.assets, l.args.shares);
        },
      }),
      publicClient.watchContractEvent({
        ...base,
        eventName: "Withdraw",
        onLogs: (logs) => {
          for (const l of logs)
            if (l.args.owner && l.args.assets !== undefined && l.args.shares !== undefined)
              void this.onWithdraw(vault, l.args.owner, l.args.assets, l.args.shares);
        },
      }),
      publicClient.watchContractEvent({
        ...base,
        eventName: "RiskPreferenceUpdated",
        onLogs: (logs) => {
          for (const l of logs)
            if (l.args.level !== undefined)
              void this.onRiskPreferenceUpdated(
                vault,
                l.args.level,
                l.args.lowBps ?? 0,
                l.args.medBps ?? 0,
                l.args.highBps ?? 0,
              );
        },
      }),
    );
  }

  /** Subscribe to VaultDeployed + ActivityLogged + per-vault events. Returns an unsubscribe fn. */
  startWatching(): () => void {
    const unwatch: (() => void)[] = [];
    if (addresses.vaultFactory) {
      unwatch.push(
        publicClient.watchContractEvent({
          address: as0x(addresses.vaultFactory),
          abi: VAULT_FACTORY_ABI,
          eventName: "VaultDeployed",
          onLogs: (logs) => {
            for (const l of logs) {
              if (l.args.user && l.args.vault) {
                void this.onVaultDeployed(l.args.user, l.args.vault, l.blockNumber);
                this.watchVault(l.args.vault, unwatch); // watch the new vault's events
              }
            }
          },
        }),
      );
      // attach watchers for vaults that already exist
      void this.listVaults()
        .then((vaults) => vaults.forEach((v) => this.watchVault(v, unwatch)))
        .catch((err) => log.error({ err }, "failed to enumerate vaults for watching"));
    }
    if (addresses.activityLog) {
      unwatch.push(
        publicClient.watchContractEvent({
          address: as0x(addresses.activityLog),
          abi: ACTIVITY_LOG_ABI,
          eventName: "ActivityLogged",
          onLogs: (logs) => {
            for (const l of logs) {
              if (l.args.vault && l.args.agent && l.args.action && l.args.timestamp !== undefined) {
                void this.onActivityLogged({
                  vault: l.args.vault,
                  agent: l.args.agent,
                  action: l.args.action,
                  timestampSec: l.args.timestamp,
                  txHash: l.transactionHash ?? null,
                  blockNumber: l.blockNumber,
                });
              }
            }
          },
        }),
      );
    }
    log.info({ subscriptions: unwatch.length }, "indexer watching");
    return () => unwatch.forEach((u) => u());
  }
}

export const indexerService = new IndexerService();
