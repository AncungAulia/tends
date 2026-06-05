import { Prisma } from "@prisma/client";
import { prisma } from "../db/client.js";
import { TOKENS, type TokenSymbol } from "../chain/tokens.js";

/** Effective agent guardrails for a vault (defaults applied). */
export interface AgentConfigValue {
  vaultAddress: string;
  autoRebalanceEnabled: boolean;
  cadenceSec: number | null;
  driftThresholdBps: number | null;
  maxSlippageBps: number;
  perTokenCapsBps: Partial<Record<TokenSymbol, number>> | null;
  notes: string | null;
  maxPerAssetPct: number | null;
  dailyLimitPerDay: number | null;
  stopLossEnabled: boolean;
  stopLossPct: number | null;
}

/** A partial patch the user submits (every field optional). */
export type AgentConfigPatch = Partial<Omit<AgentConfigValue, "vaultAddress">>;

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfigValue, "vaultAddress"> = {
  autoRebalanceEnabled: true,
  cadenceSec: null,
  driftThresholdBps: null,
  maxSlippageBps: 100,
  perTokenCapsBps: null,
  notes: null,
  maxPerAssetPct: null,
  dailyLimitPerDay: null,
  stopLossEnabled: false,
  stopLossPct: null,
};

const intIn = (v: unknown, lo: number, hi: number, name: string): number => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`${name} must be an integer in [${lo}, ${hi}]`);
  }
  return v;
};

/** Pure: validate + normalize a patch. Throws Error on invalid input. */
export function validateAgentConfig(input: AgentConfigPatch): AgentConfigPatch {
  const out: AgentConfigPatch = {};
  if (input.autoRebalanceEnabled !== undefined)
    out.autoRebalanceEnabled = Boolean(input.autoRebalanceEnabled);
  if (input.cadenceSec !== undefined)
    out.cadenceSec = input.cadenceSec === null ? null : intIn(input.cadenceSec, 0, 31_536_000, "cadenceSec");
  if (input.driftThresholdBps !== undefined)
    out.driftThresholdBps =
      input.driftThresholdBps === null ? null : intIn(input.driftThresholdBps, 0, 10_000, "driftThresholdBps");
  if (input.maxSlippageBps !== undefined)
    out.maxSlippageBps = intIn(input.maxSlippageBps, 0, 5_000, "maxSlippageBps");
  if (input.perTokenCapsBps !== undefined) {
    if (input.perTokenCapsBps === null) out.perTokenCapsBps = null;
    else {
      for (const [k, v] of Object.entries(input.perTokenCapsBps)) {
        if (!(k in TOKENS)) throw new Error(`unknown token in perTokenCapsBps: ${k}`);
        intIn(v, 0, 10_000, `cap for ${k}`);
      }
      out.perTokenCapsBps = input.perTokenCapsBps;
    }
  }
  if (input.notes !== undefined) {
    if (input.notes !== null && (typeof input.notes !== "string" || input.notes.length > 1_000))
      throw new Error("notes must be a string ≤ 1000 chars or null");
    out.notes = input.notes;
  }
  if (input.maxPerAssetPct !== undefined)
    out.maxPerAssetPct = input.maxPerAssetPct === null ? null : intIn(input.maxPerAssetPct, 1, 100, "maxPerAssetPct");
  if (input.dailyLimitPerDay !== undefined)
    out.dailyLimitPerDay = input.dailyLimitPerDay === null ? null : intIn(input.dailyLimitPerDay, 1, 100, "dailyLimitPerDay");
  if (input.stopLossEnabled !== undefined)
    out.stopLossEnabled = Boolean(input.stopLossEnabled);
  if (input.stopLossPct !== undefined)
    out.stopLossPct = input.stopLossPct === null ? null : intIn(input.stopLossPct, 1, 100, "stopLossPct");
  return out;
}

/** JSON column value for Prisma write (DbNull clears the column). */
const jsonOrNull = (v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);

/** Effective config for a vault — stored row merged over defaults. */
export async function getAgentConfig(vaultAddress: string): Promise<AgentConfigValue> {
  const row = await prisma.agentConfig.findUnique({ where: { vaultAddress } });
  if (!row) return { vaultAddress, ...DEFAULT_AGENT_CONFIG };
  return {
    vaultAddress,
    autoRebalanceEnabled: row.autoRebalanceEnabled,
    cadenceSec: row.cadenceSec,
    driftThresholdBps: row.driftThresholdBps,
    maxSlippageBps: row.maxSlippageBps,
    perTokenCapsBps: (row.perTokenCapsBps as AgentConfigValue["perTokenCapsBps"]) ?? null,
    notes: row.notes,
    maxPerAssetPct: row.maxPerAssetPct,
    dailyLimitPerDay: row.dailyLimitPerDay,
    stopLossEnabled: row.stopLossEnabled,
    stopLossPct: row.stopLossPct,
  };
}

/** Validate + upsert a patch; returns the effective config. */
export async function upsertAgentConfig(
  vaultAddress: string,
  patch: AgentConfigPatch,
): Promise<AgentConfigValue> {
  const c = validateAgentConfig(patch);
  const caps = c.perTokenCapsBps !== undefined ? jsonOrNull(c.perTokenCapsBps) : undefined;
  await prisma.agentConfig.upsert({
    where: { vaultAddress },
    create: {
      vaultAddress,
      autoRebalanceEnabled: c.autoRebalanceEnabled ?? DEFAULT_AGENT_CONFIG.autoRebalanceEnabled,
      cadenceSec: c.cadenceSec ?? null,
      driftThresholdBps: c.driftThresholdBps ?? null,
      maxSlippageBps: c.maxSlippageBps ?? DEFAULT_AGENT_CONFIG.maxSlippageBps,
      perTokenCapsBps: caps === undefined ? Prisma.DbNull : caps,
      notes: c.notes ?? null,
      maxPerAssetPct: c.maxPerAssetPct ?? null,
      dailyLimitPerDay: c.dailyLimitPerDay ?? null,
      stopLossEnabled: c.stopLossEnabled ?? false,
      stopLossPct: c.stopLossPct ?? null,
    },
    update: {
      ...(c.autoRebalanceEnabled !== undefined && { autoRebalanceEnabled: c.autoRebalanceEnabled }),
      ...(c.cadenceSec !== undefined && { cadenceSec: c.cadenceSec }),
      ...(c.driftThresholdBps !== undefined && { driftThresholdBps: c.driftThresholdBps }),
      ...(c.maxSlippageBps !== undefined && { maxSlippageBps: c.maxSlippageBps }),
      ...(caps !== undefined && { perTokenCapsBps: caps }),
      ...(c.notes !== undefined && { notes: c.notes }),
      ...(c.maxPerAssetPct !== undefined && { maxPerAssetPct: c.maxPerAssetPct }),
      ...(c.dailyLimitPerDay !== undefined && { dailyLimitPerDay: c.dailyLimitPerDay }),
      ...(c.stopLossEnabled !== undefined && { stopLossEnabled: c.stopLossEnabled }),
      ...(c.stopLossPct !== undefined && { stopLossPct: c.stopLossPct }),
    },
  });
  return getAgentConfig(vaultAddress);
}

/** Set the off-chain pause flag. */
export const setAutoRebalance = (vaultAddress: string, enabled: boolean): Promise<AgentConfigValue> =>
  upsertAgentConfig(vaultAddress, { autoRebalanceEnabled: enabled });
