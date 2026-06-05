import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { prisma } from "../../db/client.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { buildPnlSeries } from "../../services/pnl.js";

/** Days a PnL `range` maps to. Clamped to one of these (default 30). */
const PNL_RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

/** Data access for the authenticated user. Injectable so routes test without a DB. */
export interface UserReader {
  getPosition(privyId: string): Promise<unknown>;
  getActivity(privyId: string): Promise<unknown>;
  /** Vault value/PnL time-series for the FE chart, over the last `days`. */
  getPnl(privyId: string, days: number): Promise<unknown>;
}

/** Default reader backed by Prisma (per-user vault + its agent activity). */
export const prismaUserReader: UserReader = {
  async getPosition(privyId) {
    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { vault: true },
    });
    return { vault: user?.vault ?? null };
  },
  async getActivity(privyId) {
    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { vault: true },
    });
    if (!user?.vault) return { activities: [] };
    const activities = await prisma.agentActivity.findMany({
      where: { vaultAddress: user.vault.address },
      orderBy: { timestamp: "desc" },
      take: 20,
    });
    return { activities };
  },
  async getPnl(privyId, days) {
    const user = await prisma.user.findUnique({
      where: { privyId },
      include: { vault: true },
    });
    if (!user?.vault) return { vault: null, initialDepositUsd: 0, points: [] };
    const since = new Date(Date.now() - days * 86_400_000);
    const snaps = await prisma.vaultSnapshot.findMany({
      where: { vaultAddress: user.vault.address, snapshotAt: { gte: since } },
      orderBy: { snapshotAt: "asc" },
      select: { totalAssets: true, snapshotAt: true },
    });
    const { initialDepositUsd, points } = buildPnlSeries(
      snaps.map((s) => ({ totalAssets: s.totalAssets.toString(), snapshotAt: s.snapshotAt })),
      user.vault.initialDeposit.toString(),
    );
    return { vault: user.vault.address, initialDepositUsd, points };
  },
};

/** Build the /api/users/me router with an injected reader + auth middleware. */
export function makeUsersRouter(
  reader: UserReader,
  auth: MiddlewareHandler<AuthVars>,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.use("*", auth);
  r.get("/position", async (c) => c.json(await reader.getPosition(c.get("privyId"))));
  r.get("/activity", async (c) => c.json(await reader.getActivity(c.get("privyId"))));
  // PnL value-series for the chart. ?range=7d|30d|90d|1y (or ?days=N). Default 30d.
  r.get("/pnl", async (c) => {
    const range = c.req.query("range");
    const daysParam = Number(c.req.query("days"));
    const days =
      range && range in PNL_RANGES
        ? PNL_RANGES[range]!
        : Number.isFinite(daysParam) && daysParam > 0
          ? Math.min(daysParam, 365)
          : 30;
    return c.json(await reader.getPnl(c.get("privyId"), days));
  });
  return r;
}

export const usersRouter = makeUsersRouter(prismaUserReader, requireAuth);
