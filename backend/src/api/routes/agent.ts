import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { as0x } from "../../chain/addresses.js";
import {
  getAgentConfig,
  upsertAgentConfig,
  setAutoRebalance,
  type AgentConfigPatch,
} from "../../services/agent-config.js";
import { rebalancerService } from "../../services/rebalancer.js";
import { readHoldings } from "../../services/holdings.js";

/** Per-user agent + portfolio data access. Injectable so routes test without DB/chain. */
export interface AgentDeps {
  /** Privy session → user's vault address + cost basis (initialDeposit, USDC base units). */
  resolveVault: (privyId: string) => Promise<{ vaultAddress: string | null; initialDeposit: string }>;
  getConfig: (vault: string) => Promise<unknown>;
  saveConfig: (vault: string, patch: AgentConfigPatch) => Promise<unknown>;
  setPause: (vault: string, enabled: boolean) => Promise<unknown>;
  runNow: (vault: `0x${string}`) => Promise<unknown>;
  agentLog: (vault: string, limit: number) => Promise<unknown>;
  holdings: (vault: `0x${string}`) => Promise<{ holdings: unknown[]; totalValueUsd: string }>;
  getPrefs: (privyId: string) => Promise<unknown>;
  savePrefs: (privyId: string, prefs: unknown) => Promise<unknown>;
}

const USDC = 1e6;

export const prismaAgentDeps: AgentDeps = {
  resolveVault: async (privyId) => {
    const user = await prisma.user.findUnique({ where: { privyId }, include: { vault: true } });
    return {
      vaultAddress: user?.vault?.address ?? null,
      initialDeposit: user?.vault?.initialDeposit?.toString() ?? "0",
    };
  },
  getConfig: (vault) => getAgentConfig(vault),
  saveConfig: (vault, patch) => upsertAgentConfig(vault, patch),
  setPause: (vault, enabled) => setAutoRebalance(vault, enabled),
  runNow: (vault) => rebalancerService.runNow(vault),
  agentLog: (vault, limit) =>
    prisma.agentActivity.findMany({
      where: { vaultAddress: vault },
      orderBy: { timestamp: "desc" },
      take: limit,
    }),
  holdings: (vault) => readHoldings(vault),
  getPrefs: async (privyId) => {
    const user = await prisma.user.findUnique({ where: { privyId }, select: { preferences: true } });
    return user?.preferences ?? {};
  },
  savePrefs: async (privyId, prefs) => {
    const user = await prisma.user.findUnique({ where: { privyId }, select: { walletAddress: true } });
    if (!user) return {};
    await prisma.user.update({ where: { walletAddress: user.walletAddress }, data: { preferences: prefs as object } });
    return prefs;
  },
};

const NO_VAULT = { error: "no vault deployed" } as const;

const configBody = z.object({
  autoRebalanceEnabled: z.boolean().optional(),
  cadenceSec: z.number().int().nonnegative().nullable().optional(),
  driftThresholdBps: z.number().int().min(0).max(10_000).nullable().optional(),
  maxSlippageBps: z.number().int().min(0).max(5_000).optional(),
  perTokenCapsBps: z.record(z.string(), z.number().int().min(0).max(10_000)).nullable().optional(),
  notes: z.string().max(1_000).nullable().optional(),
});

/**
 * The FE "Agent" page + portfolio/preferences endpoints, all under /api/users/me
 * (Privy-authed). Agent guardrails drive the autonomous rebalancer; holdings/portfolio
 * read on-chain; preferences are per-user UI state.
 */
export function makeAgentRouter(deps: AgentDeps, auth: MiddlewareHandler<AuthVars>): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.use("*", auth);

  const withVault = async (
    privyId: string,
    fn: (vault: `0x${string}`, ctx: { initialDeposit: string }) => Promise<unknown>,
  ) => {
    const { vaultAddress, initialDeposit } = await deps.resolveVault(privyId);
    if (!vaultAddress) return null;
    return fn(as0x(vaultAddress), { initialDeposit });
  };

  // ── Agent guardrails / config ──────────────────────────────────────────────
  r.get("/agent-config", async (c) => {
    const out = await withVault(c.get("privyId"), (v) => deps.getConfig(v));
    return out === null ? c.json(NO_VAULT, 404) : c.json(out);
  });
  r.post("/agent-config", async (c) => {
    const parsed = configBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
    try {
      const out = await withVault(c.get("privyId"), (v) => deps.saveConfig(v, parsed.data));
      return out === null ? c.json(NO_VAULT, 404) : c.json(out);
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400);
    }
  });

  // ── Pause / resume / run-now ───────────────────────────────────────────────
  r.patch("/agent/pause", async (c) => {
    const out = await withVault(c.get("privyId"), (v) => deps.setPause(v, false));
    return out === null ? c.json(NO_VAULT, 404) : c.json(out);
  });
  r.patch("/agent/resume", async (c) => {
    const out = await withVault(c.get("privyId"), (v) => deps.setPause(v, true));
    return out === null ? c.json(NO_VAULT, 404) : c.json(out);
  });
  r.post("/agent/run-now", async (c) => {
    const out = await withVault(c.get("privyId"), (v) => deps.runNow(v));
    return out === null ? c.json(NO_VAULT, 404) : c.json(out);
  });

  // ── Agent run log ──────────────────────────────────────────────────────────
  r.get("/agent-log", async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query("limit")) || 20, 1), 100);
    const out = await withVault(c.get("privyId"), (v) => deps.agentLog(v, limit));
    return out === null ? c.json({ activities: [] }) : c.json({ activities: out });
  });

  // ── Holdings + portfolio snapshot ──────────────────────────────────────────
  r.get("/holdings", async (c) => {
    const out = await withVault(c.get("privyId"), (v) => deps.holdings(v));
    return out === null ? c.json({ holdings: [], totalValueUsd: "0" }) : c.json(out);
  });
  r.get("/portfolio", async (c) => {
    const out = await withVault(c.get("privyId"), async (v, { initialDeposit }) => {
      const { holdings, totalValueUsd } = await deps.holdings(v);
      const valueUsd = Number(totalValueUsd);
      const depositUsd = Number(initialDeposit) / USDC;
      const pnlUsd = valueUsd - depositUsd;
      return {
        totalValueUsd: valueUsd,
        initialDepositUsd: depositUsd,
        pnlUsd,
        pnlPct: depositUsd > 0 ? (pnlUsd / depositUsd) * 100 : 0,
        holdings,
      };
    });
    return out === null
      ? c.json({ totalValueUsd: 0, initialDepositUsd: 0, pnlUsd: 0, pnlPct: 0, holdings: [] })
      : c.json(out);
  });

  // ── UI preferences (per user, not per vault) ───────────────────────────────
  r.get("/preferences", async (c) => c.json(await deps.getPrefs(c.get("privyId"))));
  r.put("/preferences", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== "object") return c.json({ error: "invalid body" }, 400);
    return c.json(await deps.savePrefs(c.get("privyId"), body));
  });

  return r;
}

export const agentRouter = makeAgentRouter(prismaAgentDeps, requireAuth);
