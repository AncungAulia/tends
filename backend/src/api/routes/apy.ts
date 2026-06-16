import { Hono } from "hono";
import { prisma } from "../../db/client.js";
import { apyService } from "../../services/apy.js";

export interface ApyReader {
  history(asset: string, days: number): Promise<unknown[]>;
}

export const prismaApyReader: ApyReader = {
  async history(asset, days) {
    const since = new Date(Date.now() - days * 86_400_000);
    return prisma.apyHistory.findMany({
      where: { asset, snapshotAt: { gte: since } },
      orderBy: { snapshotAt: "asc" },
    });
  },
};

/**
 * GET /api/apy/history?asset=mETH&days=30 — historical APY series for charts.
 * GET /api/apy/map — current per-token APY (% per year). Powers the
 *   dashboard's "Estimated APY" so it reflects the user's ACTUAL holdings
 *   blended yield, not the preset strategy's projected APY.
 */
export function makeApyRouter(reader: ApyReader): Hono {
  const r = new Hono();
  r.get("/history", async (c) => {
    const asset = c.req.query("asset");
    const days = Number(c.req.query("days") ?? "30");
    if (!asset) return c.json({ error: "asset query param required" }, 400);
    if (!Number.isFinite(days) || days <= 0) return c.json({ error: "invalid days" }, 400);
    return c.json({ asset, days, history: await reader.history(asset, days) });
  });
  r.get("/map", async (c) => c.json({ apy: await apyService.getApyMap() }));
  return r;
}

export const apyRouter = makeApyRouter(prismaApyReader);
