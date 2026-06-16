import { Prisma } from "@prisma/client";
import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { VAULT_FACTORY_ABI, ACTIVITY_LOG_ABI, USER_VAULT_ABI } from "../chain/abis.js";
import { wsHub, type WsEvent } from "../ws/hub.js";
import { rebalancerService } from "./rebalancer.js";

const log = childLogger("indexer");

// Inline ABI event definitions for getLogs calls (backfill)
const DEPOSIT_EVENT = {
  name: "Deposit",
  type: "event",
  inputs: [
    { name: "sender", type: "address", indexed: true },
    { name: "owner", type: "address", indexed: true },
    { name: "assets", type: "uint256", indexed: false },
    { name: "shares", type: "uint256", indexed: false },
  ],
} as const;

const WITHDRAW_EVENT = {
  name: "Withdraw",
  type: "event",
  inputs: [
    { name: "sender", type: "address", indexed: true },
    { name: "receiver", type: "address", indexed: true },
    { name: "owner", type: "address", indexed: true },
    { name: "assets", type: "uint256", indexed: false },
    { name: "shares", type: "uint256", indexed: false },
  ],
} as const;

/** Default deposit hook: rebalance the vault now (processVault respects cooldown/pause/balanced). */
async function defaultTriggerRebalance(vault: `0x${string}`): Promise<void> {
  await rebalancerService.processVault(vault);
}

/** Default on-chain owner reader for backfill: UserVault.owner(). */
function defaultReadVaultOwner(vault: `0x${string}`): Promise<string> {
  return publicClient.readContract({ address: vault, abi: USER_VAULT_ABI, functionName: "owner" });
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

/**
 * Vault upsert args that CREATE the owner `User` if it doesn't exist yet
 * (`connectOrCreate`). On-chain `VaultDeployed`/`Deposit` events can be indexed
 * before the owner has authenticated (no User row), and `Vault.owner` is a FK to
 * `User.walletAddress` — without this the upsert fails with a foreign-key error
 * (P2003) and the vault is never recorded. The owner FK is set via the relation,
 * so we must NOT also pass a scalar `owner`.
 */
export function toVaultUpsertArgs(rec: VaultRecord): Prisma.VaultUpsertArgs {
  return {
    where: { address: rec.address },
    create: {
      address: rec.address,
      deployedBlock: rec.deployedBlock,
      user: {
        connectOrCreate: {
          where: { walletAddress: rec.owner },
          create: { walletAddress: rec.owner },
        },
      },
    },
    update: { ...(rec.deployedBlock !== null ? { deployedBlock: rec.deployedBlock } : {}) },
  };
}

/** Position upsert args (deposit) — same owner-User `connectOrCreate` guard. */
export function toPositionUpsertArgs(
  vault: string,
  owner: string,
  shares: bigint,
  assets: bigint,
): Prisma.VaultUpsertArgs {
  return {
    where: { address: vault },
    create: {
      address: vault,
      shares: shares.toString(),
      initialDeposit: assets.toString(),
      user: {
        connectOrCreate: {
          where: { walletAddress: owner },
          create: { walletAddress: owner },
        },
      },
    },
    update: {
      shares: { increment: shares.toString() },
      initialDeposit: { increment: assets.toString() },
    },
  };
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
    await prisma.vault.upsert(toVaultUpsertArgs(rec));
  },
  async recordActivity(rec) {
    await prisma.agentActivity.create({
      data: { ...rec, metadata: rec.metadata as Prisma.InputJsonValue },
    });
  },
  async addToPosition(vault, owner, shares, assets) {
    await prisma.vault.upsert(toPositionUpsertArgs(vault, owner, shares, assets));
  },
  async subFromPosition(vault, shares) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.vault.findUniqueOrThrow({
        where: { address: vault },
        select: { shares: true, initialDeposit: true },
      });
      const totalShares = BigInt(current.shares.toString());
      const costBasis = BigInt(current.initialDeposit.toString());
      const remainingShares = totalShares > shares ? totalShares - shares : 0n;
      // cost-basis reduced proportionally, not by current value — keeps PnL correct on partial withdraws
      const newCostBasis = totalShares > 0n ? (costBasis * remainingShares) / totalShares : 0n;
      await tx.vault.update({
        where: { address: vault },
        data: {
          shares: { decrement: shares.toString() },
          initialDeposit: newCostBasis.toString(),
        },
      });
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
    // backfill: read an existing vault's owner on-chain (UserVault.owner())
    private readonly readVaultOwner: (vault: `0x${string}`) => Promise<string> = defaultReadVaultOwner,
  ) {}

  async onVaultDeployed(user: string, vault: string, blockNumber: bigint | null): Promise<void> {
    await this.repo.upsertVault(toVaultRecord(user, vault, blockNumber));
    this.broadcast({ type: "vault_deployed", user, vault });
    log.info({ user, vault }, "vault deployed");
  }

  /**
   * Backfill an already-deployed vault into the DB. watchContractEvent only sees
   * events from when the watcher attaches, so vaults deployed before startup (or
   * during a restart's downtime) would never be recorded otherwise. Idempotent
   * (upsert); reads the owner on-chain. Runs for every existing vault at startup.
   */
  async backfillVault(vault: `0x${string}`): Promise<void> {
    const owner = await this.readVaultOwner(vault);
    await this.repo.upsertVault(toVaultRecord(owner, vault, null));

    // Sync riskPreference first — isolated from getLogs so DRPC errors there don't block this.
    const base = { address: vault, abi: USER_VAULT_ABI } as const;
    const riskOnChain = await publicClient.readContract({ ...base, functionName: "riskPreference" }).catch(() => null);
    if (riskOnChain != null) {
      const level = Number(riskOnChain);
      let lowBps = 0, medBps = 0, highBps = 0;
      if (level === 3) {
        const alloc = await publicClient.readContract({ ...base, functionName: "customAllocation" }).catch(() => null);
        if (alloc) { [lowBps, medBps, highBps] = alloc as [number, number, number]; }
      }
      await this.repo.setRiskPreference(vault, toRiskUpdate(level, lowBps, medBps, highBps));
    }

    // DRPC free tier: eth_getLogs max 10 000 blocks, paginate in 9 000-block chunks.
    // fromBlock: stored deployedBlock (most precise) or fallback to last 200 000 blocks.
    // Historical-log sync is best-effort: the vault + risk are already persisted above,
    // so an RPC failure here must not abort the backfill (or break tests with no RPC).
    const latest = await publicClient.getBlockNumber().catch(() => null);
    if (latest === null) {
      log.warn({ vault, owner }, "vault backfilled (historical deposit sync skipped: RPC unavailable)");
      return;
    }
    const stored = await prisma.vault.findUnique({
      where: { address: vault },
      select: { deployedBlock: true },
    });
    const fromBlock = stored?.deployedBlock ?? (latest > 200_000n ? latest - 200_000n : 0n);
    const PAGE = 9_000n;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLogsPaged = async (event: any): Promise<any[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acc: any[] = [];
      for (let from = fromBlock; from <= latest; from += PAGE) {
        const to = from + PAGE - 1n > latest ? latest : from + PAGE - 1n;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        acc.push(...((await publicClient.getLogs({ address: vault, event, fromBlock: from, toBlock: to })) as any[]));
      }
      return acc;
    };

    const [depositLogs, withdrawLogs] = await Promise.all([
      getLogsPaged(DEPOSIT_EVENT),
      getLogsPaged(WITHDRAW_EVENT),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]).catch(() => [[], []] as [any[], any[]]); // RPC failure → treat as no history, keep the upsert


    let totalDepositedAssets = 0n;
    let totalDepositedShares = 0n;
    for (const l of depositLogs) {
      if (l.args.assets !== undefined && l.args.shares !== undefined) {
        totalDepositedAssets += BigInt(l.args.assets);
        totalDepositedShares += BigInt(l.args.shares);
      }
    }
    let totalWithdrawnShares = 0n;
    for (const l of withdrawLogs) {
      if (l.args.shares !== undefined) totalWithdrawnShares += BigInt(l.args.shares);
    }

    if (totalDepositedShares === 0n) {
      log.info({ vault, owner, riskOnChain }, "vault backfilled (no deposits)");
      return;
    }

    const currentShares = totalDepositedShares - totalWithdrawnShares;
    // Proportional cost-basis: portion of deposited assets still held
    const initialDeposit = (totalDepositedAssets * currentShares) / totalDepositedShares;
    await prisma.vault.update({
      where: { address: vault },
      data: { shares: currentShares.toString(), initialDeposit: initialDeposit.toString() },
    });
    log.info(
      { vault, owner, riskOnChain, currentShares: currentShares.toString(), initialDeposit: initialDeposit.toString() },
      "vault backfilled",
    );
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
    // REBALANCE is indexed from the UserVault Rebalanced event (which carries swap count).
    // Skipping here prevents a duplicate record with empty metadata.
    if (args.action.toUpperCase() === "REBALANCE") return;
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
    // rebalance the remainder back to target (best-effort — never breaks indexing)
    await this.triggerRebalance(vault as `0x${string}`).catch((err) =>
      log.warn({ vault, err }, "withdraw-triggered rebalance failed"),
    );
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
    // New target allocation — rebalance immediately toward it (best-effort)
    await this.triggerRebalance(vault as `0x${string}`).catch((err) =>
      log.warn({ vault, err }, "risk-change-triggered rebalance failed"),
    );
  }

  async onAllowedTokenUpdated(vault: string, token: string, allowed: boolean): Promise<void> {
    this.broadcast({ type: "allowed_token_updated", vault, token, allowed });
    log.info({ vault, token, allowed }, "allowed token updated");
    // Token exclusion/inclusion changes target allocation — rebalance immediately (best-effort)
    await this.triggerRebalance(vault as `0x${string}`).catch((err) =>
      log.warn({ vault, err }, "token-exclusion-triggered rebalance failed"),
    );
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

  /** Attach Deposit / Withdraw / Rebalanced / RiskPreferenceUpdated watchers for one vault. */
  private watchVault(vault: `0x${string}`, unwatch: (() => void)[]): void {
    const base = { address: vault, abi: USER_VAULT_ABI } as const;
    unwatch.push(
      publicClient.watchContractEvent({
        ...base,
        eventName: "Rebalanced",
        onLogs: (logs) => {
          for (const l of logs)
            if (l.args.agent && l.args.timestamp !== undefined && l.args.instructions)
              void this.onRebalanced({
                vault,
                agent: l.args.agent,
                timestampSec: l.args.timestamp,
                swaps: l.args.instructions.length,
                txHash: l.transactionHash ?? null,
                blockNumber: l.blockNumber,
              });
        },
      }),
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
      publicClient.watchContractEvent({
        ...base,
        eventName: "AllowedTokenUpdated",
        onLogs: (logs) => {
          for (const l of logs)
            if (l.args.token && l.args.allowed !== undefined)
              void this.onAllowedTokenUpdated(vault, l.args.token, l.args.allowed);
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
      // attach watchers for vaults that already exist + backfill them into the DB
      void this.listVaults()
        .then((vaults) =>
          vaults.forEach((v) => {
            this.watchVault(v, unwatch);
            void this.backfillVault(v).catch((err) => log.warn({ err, vault: v }, "vault backfill failed"));
          }),
        )
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
