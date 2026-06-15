import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { prisma } from "../../db/client.js";
import { requireAuth, type AuthVars } from "../auth.js";

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid address");

/** Associate a verified Privy session with a wallet (upsert the user). */
export type UpsertUser = (privyId: string, walletAddress: string) => Promise<void>;

export const prismaUpsertUser: UpsertUser = async (privyId, walletAddress) => {
  // Case-insensitive lookup so we link the privyId to an existing record even
  // when the incoming address case (lower/checksummed) differs from how it was
  // first stored (e.g. legacy users created via on-chain detection in EIP-55).
  const existing = await prisma.user.findFirst({
    where: { walletAddress: { equals: walletAddress, mode: "insensitive" } },
    select: { walletAddress: true },
  });
  const target = existing?.walletAddress ?? walletAddress;
  await prisma.$transaction([
    // A Privy account can only belong to one wallet — clear it from any other record first.
    prisma.user.updateMany({ where: { privyId, NOT: { walletAddress: target } }, data: { privyId: null } }),
    prisma.user.upsert({
      where: { walletAddress: target },
      create: { walletAddress: target, privyId },
      update: { privyId },
    }),
  ]);
};

/** POST /api/auth/verify — verify the session (via auth middleware) + upsert the user. */
export function makeAuthRouter(
  auth: MiddlewareHandler<AuthVars>,
  upsert: UpsertUser,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.post("/verify", auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ walletAddress: address }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);
    const privyId = c.get("privyId");
    await upsert(privyId, parsed.data.walletAddress);
    return c.json({ privyId, walletAddress: parsed.data.walletAddress });
  });
  return r;
}

export const authRouter = makeAuthRouter(requireAuth, prismaUpsertUser);
