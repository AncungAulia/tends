import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { prisma } from "../../db/client.js";
import { requireAuth, type AuthVars } from "../auth.js";

/** Data access for the authenticated user. Injectable so routes test without a DB. */
export interface UserReader {
  getPosition(privyId: string): Promise<unknown>;
  getActivity(privyId: string): Promise<unknown>;
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
  return r;
}

export const usersRouter = makeUsersRouter(prismaUserReader, requireAuth);
