import { Prisma } from "@prisma/client";
import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";

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

// ── Pure event → record mappers ────────────────────────────────────────────

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

// ── Repo (injectable; default Prisma-backed) ─────────────────────────────────

export interface IndexerRepo {
  upsertVault(rec: VaultRecord): Promise<void>;
  recordActivity(rec: ActivityRecord): Promise<void>;
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
};

/**
 * Indexer (per-user-vault model; backend/INTEGRATION.md §4). Event handlers are
 * pure-mapper + repo-write so they unit-test without a chain or DB; the
 * watchContractEvent wiring is thin glue over publicClient.
 *
 * TODO: scrapeAPYs() → prisma.apyHistory; watch wiring + IndexerState cursor.
 */
export class IndexerService {
  constructor(private readonly repo: IndexerRepo = prismaIndexerRepo) {}

  async onVaultDeployed(
    user: string,
    vault: string,
    blockNumber: bigint | null,
  ): Promise<void> {
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
}

export const indexerService = new IndexerService();
