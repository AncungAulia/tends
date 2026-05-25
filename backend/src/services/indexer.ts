import { Prisma } from "@prisma/client";
import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { VAULT_FACTORY_ABI, ACTIVITY_LOG_ABI } from "../chain/abis.js";
import { STATIC_APY_PCT, type ApyByToken } from "./projection.js";

const log = childLogger("indexer");

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

export interface ApyRecord {
  asset: string;
  apyPct: number;
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

/** Per-asset APY snapshot rows. */
export function toApyRecords(apy: ApyByToken): ApyRecord[] {
  return Object.entries(apy).map(([asset, apyPct]) => ({ asset, apyPct: apyPct ?? 0 }));
}

// ── Repo (injectable; default Prisma-backed) ─────────────────────────────────

export interface IndexerRepo {
  upsertVault(rec: VaultRecord): Promise<void>;
  recordActivity(rec: ActivityRecord): Promise<void>;
  recordApy(rec: ApyRecord): Promise<void>;
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
  async recordApy(rec) {
    await prisma.apyHistory.create({ data: { asset: rec.asset, apy: rec.apyPct } });
  },
};

/**
 * Indexer (per-user-vault model; backend/INTEGRATION.md §4). Event handlers are
 * pure-mapper + repo-write so they unit-test without a chain or DB; the
 * watchContractEvent wiring (startWatching) is thin glue over publicClient.
 */
export class IndexerService {
  constructor(private readonly repo: IndexerRepo = prismaIndexerRepo) {}

  async onVaultDeployed(user: string, vault: string, blockNumber: bigint | null): Promise<void> {
    await this.repo.upsertVault(toVaultRecord(user, vault, blockNumber));
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
    log.info({ vault: args.vault, action: args.action }, "activity indexed");
  }

  /** Snapshot current APYs into ApyHistory (placeholder source until a real feed). */
  async scrapeAPYs(apy: ApyByToken = STATIC_APY_PCT): Promise<void> {
    for (const rec of toApyRecords(apy)) await this.repo.recordApy(rec);
    log.info({ count: Object.keys(apy).length }, "apy snapshot written");
  }

  /** Subscribe to VaultDeployed + ActivityLogged. Returns an unsubscribe fn. */
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
              }
            }
          },
        }),
      );
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
