import { childLogger } from "../lib/logger.js";
import { prisma } from "../db/client.js";
import { publicClient } from "../chain/index.js";
import { addresses, as0x } from "../chain/addresses.js";
import { USER_VAULT_ABI } from "../chain/abis.js";
import { env } from "../config/env.js";

const log = childLogger("pnl");

/** A value-series data point served to the FE PnL chart. USDC (human) values. */
export interface PnlPoint {
  t: number; // unix seconds (lightweight-charts UTCTimestamp)
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

const USDC_DECIMALS = 6; // the vault's accounting asset; totalAssets + initialDeposit are 6-dec

/** Pure: raw snapshots + cost basis → chart points (USDC base units → human USD). */
export function buildPnlSeries(
  snaps: { totalAssets: string; snapshotAt: Date }[],
  initialDepositBase: string,
): { initialDepositUsd: number; points: PnlPoint[] } {
  const initialDepositUsd = Number(initialDepositBase) / 10 ** USDC_DECIMALS;
  const points = snaps.map((s) => {
    const valueUsd = Number(s.totalAssets) / 10 ** USDC_DECIMALS;
    const pnlUsd = valueUsd - initialDepositUsd;
    return {
      t: Math.floor(s.snapshotAt.getTime() / 1000),
      valueUsd,
      pnlUsd,
      pnlPct: initialDepositUsd > 0 ? (pnlUsd / initialDepositUsd) * 100 : 0,
    };
  });
  return { initialDepositUsd, points };
}

export interface PnlRepo {
  listVaultAddresses(): Promise<string[]>;
  saveSnapshot(vaultAddress: string, totalAssets: string): Promise<void>;
}

export const prismaPnlRepo: PnlRepo = {
  listVaultAddresses: async () => {
    const vaults = await prisma.vault.findMany({ select: { address: true } });
    return vaults.map((v) => v.address);
  },
  saveSnapshot: async (vaultAddress, totalAssets) => {
    await prisma.vaultSnapshot.create({ data: { vaultAddress, totalAssets } });
  },
};

/** Read a vault's ERC-4626 totalAssets() (USDC base units). Injectable for tests. */
export type ReadTotalAssets = (vault: `0x${string}`) => Promise<bigint>;

const defaultReadTotalAssets: ReadTotalAssets = (vault) =>
  publicClient.readContract({ address: vault, abi: USER_VAULT_ABI, functionName: "totalAssets" });

/**
 * Snapshots each vault's `UserVault.totalAssets()` into VaultSnapshot on a schedule.
 * Same valuation basis the FE/dashboard uses for the current value (and the same unit
 * as `Vault.initialDeposit`), so the PnL chart stays consistent with the live PnL
 * number. Per-vault failures are isolated. Driven by `src/scheduler.ts` (hourly).
 */
export class PnlService {
  constructor(
    private readonly repo: PnlRepo = prismaPnlRepo,
    private readonly useMock: boolean = env.USE_MOCK_CONTRACTS,
    private readonly readTotalAssets: ReadTotalAssets = defaultReadTotalAssets,
  ) {}

  async run(): Promise<void> {
    if (this.useMock || !addresses.vaultFactory) {
      log.warn("vault factory not configured (mock mode) — skipping pnl snapshot");
      return;
    }
    const vaults = await this.repo.listVaultAddresses();
    let ok = 0;
    for (const v of vaults) {
      try {
        const total = await this.readTotalAssets(as0x(v));
        await this.repo.saveSnapshot(v, total.toString());
        ok++;
      } catch (err) {
        log.warn({ vault: v, err }, "vault snapshot failed");
      }
    }
    log.info({ vaults: vaults.length, ok }, "pnl snapshots written");
  }
}

export const pnlService = new PnlService();
