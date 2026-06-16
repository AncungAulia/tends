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
  /** Per-token drift band in bps; a holding outside [min,max] triggers a rebalance. */
  perTokenBandsBps: Partial<Record<TokenSymbol, { min: number; max: number }>> | null;
  notes: string | null;
  maxPerAssetPct: number | null;
  dailyLimitPerDay: number | null;
  stopLossEnabled: boolean;
  stopLossPct: number | null;
  /** Tokens the agent must NOT hold — dropped from target & redistributed. */
  excludedTokens: TokenSymbol[];
}

/** A partial patch the user submits (every field optional). `excludedTokens` is a
 *  raw string list at the API boundary — validateAgentConfig narrows it to known
 *  TokenSymbols and rejects unknowns + USDC. */
export type AgentConfigPatch = Partial<
  Omit<AgentConfigValue, "vaultAddress" | "excludedTokens">
> & { excludedTokens?: string[] };

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfigValue, "vaultAddress"> = {
  autoRebalanceEnabled: true,
  cadenceSec: null,
  // 5% deadband: only rebalance a position when its drift exceeds 5% of portfolio
  // value, so noise doesn't trigger trades (anti-overtrading). Was null (no deadband).
  // Per-tier tuning (LOW tighter, HIGH looser) is a later refinement; see RISK_TIERS_BRIEF.
  driftThresholdBps: 500,
  maxSlippageBps: 100,
  perTokenCapsBps: null,
  perTokenBandsBps: null,
  notes: null,
  maxPerAssetPct: null,
  dailyLimitPerDay: null,
  stopLossEnabled: false,
  stopLossPct: null,
  excludedTokens: [],
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
  if (input.perTokenBandsBps !== undefined) {
    if (input.perTokenBandsBps === null) out.perTokenBandsBps = null;
    else {
      for (const [k, band] of Object.entries(input.perTokenBandsBps)) {
        if (!(k in TOKENS)) throw new Error(`unknown token in perTokenBandsBps: ${k}`);
        if (!band || typeof band !== "object") throw new Error(`band for ${k} must be { min, max }`);
        const min = intIn((band as { min: unknown }).min, 0, 10_000, `band.min for ${k}`);
        const max = intIn((band as { max: unknown }).max, 0, 10_000, `band.max for ${k}`);
        if (min > max) throw new Error(`band.min (${min}) must be ≤ band.max (${max}) for ${k}`);
      }
      out.perTokenBandsBps = input.perTokenBandsBps;
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
  if (input.excludedTokens !== undefined) {
    if (!Array.isArray(input.excludedTokens))
      throw new Error("excludedTokens must be an array of token symbols");
    // USDC is the vault's unit of account — refuse to exclude it (no routing medium).
    const seen = new Set<TokenSymbol>();
    for (const sym of input.excludedTokens) {
      if (typeof sym !== "string" || !(sym in TOKENS))
        throw new Error(`unknown token in excludedTokens: ${sym}`);
      if (sym === "USDC")
        throw new Error("USDC cannot be excluded — it's the vault's base asset");
      seen.add(sym as TokenSymbol);
    }
    out.excludedTokens = [...seen];
  }
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
    perTokenBandsBps: (row.perTokenBandsBps as AgentConfigValue["perTokenBandsBps"]) ?? null,
    notes: row.notes,
    maxPerAssetPct: row.maxPerAssetPct,
    dailyLimitPerDay: row.dailyLimitPerDay,
    stopLossEnabled: row.stopLossEnabled,
    stopLossPct: row.stopLossPct,
    excludedTokens: (row.excludedTokens ?? []).filter(
      (s): s is TokenSymbol => s in TOKENS,
    ),
  };
}

/** Validate + upsert a patch; returns the effective config. */
export async function upsertAgentConfig(
  vaultAddress: string,
  patch: AgentConfigPatch,
): Promise<AgentConfigValue> {
  const c = validateAgentConfig(patch);
  const caps = c.perTokenCapsBps !== undefined ? jsonOrNull(c.perTokenCapsBps) : undefined;
  const bands = c.perTokenBandsBps !== undefined ? jsonOrNull(c.perTokenBandsBps) : undefined;
  await prisma.agentConfig.upsert({
    where: { vaultAddress },
    create: {
      vaultAddress,
      autoRebalanceEnabled: c.autoRebalanceEnabled ?? DEFAULT_AGENT_CONFIG.autoRebalanceEnabled,
      cadenceSec: c.cadenceSec ?? null,
      driftThresholdBps: c.driftThresholdBps ?? null,
      maxSlippageBps: c.maxSlippageBps ?? DEFAULT_AGENT_CONFIG.maxSlippageBps,
      perTokenCapsBps: caps === undefined ? Prisma.DbNull : caps,
      perTokenBandsBps: bands === undefined ? Prisma.DbNull : bands,
      notes: c.notes ?? null,
      maxPerAssetPct: c.maxPerAssetPct ?? null,
      dailyLimitPerDay: c.dailyLimitPerDay ?? null,
      stopLossEnabled: c.stopLossEnabled ?? false,
      stopLossPct: c.stopLossPct ?? null,
      excludedTokens: c.excludedTokens ?? [],
    },
    update: {
      ...(c.autoRebalanceEnabled !== undefined && { autoRebalanceEnabled: c.autoRebalanceEnabled }),
      ...(c.cadenceSec !== undefined && { cadenceSec: c.cadenceSec }),
      ...(c.driftThresholdBps !== undefined && { driftThresholdBps: c.driftThresholdBps }),
      ...(c.maxSlippageBps !== undefined && { maxSlippageBps: c.maxSlippageBps }),
      ...(caps !== undefined && { perTokenCapsBps: caps }),
      ...(bands !== undefined && { perTokenBandsBps: bands }),
      ...(c.notes !== undefined && { notes: c.notes }),
      ...(c.maxPerAssetPct !== undefined && { maxPerAssetPct: c.maxPerAssetPct }),
      ...(c.dailyLimitPerDay !== undefined && { dailyLimitPerDay: c.dailyLimitPerDay }),
      ...(c.stopLossEnabled !== undefined && { stopLossEnabled: c.stopLossEnabled }),
      ...(c.stopLossPct !== undefined && { stopLossPct: c.stopLossPct }),
      ...(c.excludedTokens !== undefined && { excludedTokens: c.excludedTokens }),
    },
  });
  return getAgentConfig(vaultAddress);
}

/** Set the off-chain pause flag. */
export const setAutoRebalance = (vaultAddress: string, enabled: boolean): Promise<AgentConfigValue> =>
  upsertAgentConfig(vaultAddress, { autoRebalanceEnabled: enabled });
