import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { streamChat, type ChatMessage } from "../../agents/hermes-client.js";
import { prisma } from "../../db/client.js";
import { childLogger } from "../../lib/logger.js";
import { requireAuth, type AuthVars } from "../auth.js";

const log = childLogger("chat");

export type ChatStream = (messages: ChatMessage[]) => AsyncGenerator<string>;
/** Persist a completed exchange for a user (by Privy id). */
export type ChatPersist = (privyId: string, userMsg: string, assistantMsg: string) => Promise<void>;
/** Resolve a Privy session to the user's on-chain identity. */
export type UserResolver = (
  privyId: string,
) => Promise<{ walletAddress: string | null; vaultAddress: string | null }>;

export const prismaUserResolver: UserResolver = async (privyId) => {
  const user = await prisma.user.findUnique({ where: { privyId }, include: { vault: true } });
  return { walletAddress: user?.walletAddress ?? null, vaultAddress: user?.vault?.address ?? null };
};

/** Grounding system prompt — keeps Hermes on-topic and pointed at the real portfolio. */
export function buildSystemPrompt(
  walletAddress: string | null,
  vaultAddress: string | null,
): string {
  const who = walletAddress
    ? `The current user's wallet is ${walletAddress}` +
      (vaultAddress ? `, vault ${vaultAddress}.` : " (no vault deployed yet).")
    : "The current user has not linked a wallet yet.";
  return [
    "You are Hermes, the AI portfolio manager for Tends, an AI-managed RWA vault product on Mantle.",
    "'Vault' ALWAYS means the user's on-chain ERC-4626 RWA vault holding tokenized real-world assets",
    "(mUSD, USDY, mETH, cmETH, sUSDe, WMNT) — NEVER a secrets/file/password vault.",
    who,
    "Use your tools (readUserPosition, getAgentActivity, listStrategies, computeProjection) to answer",
    "about the user's ACTUAL on-chain portfolio — do NOT answer from general knowledge. Always pass the",
    "user's wallet address to readUserPosition. Be concise, honest about risk, and never promise returns.",
  ].join(" ");
}

export const prismaChatPersist: ChatPersist = async (privyId, userMsg, assistantMsg) => {
  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) return;
  await prisma.chatMessage.createMany({
    data: [
      { walletAddress: user.walletAddress, role: "user", content: userMsg },
      { walletAddress: user.walletAddress, role: "assistant", content: assistantMsg },
    ],
  });
};

/** POST /api/chat — grounded, tool-using Hermes reply over SSE; persists the exchange. */
export function makeChatRouter(
  auth: MiddlewareHandler<AuthVars>,
  stream: ChatStream,
  persist: ChatPersist = prismaChatPersist,
  resolveUser: UserResolver = prismaUserResolver,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.post("/", auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ message: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const privyId = c.get("privyId");
    const userMsg = parsed.data.message;

    // ground the agent: who the user is + that "vault" = their on-chain RWA vault
    let walletAddress: string | null = null;
    let vaultAddress: string | null = null;
    try {
      ({ walletAddress, vaultAddress } = await resolveUser(privyId));
    } catch (err) {
      log.warn({ err }, "user resolve failed — chatting without wallet grounding");
    }

    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(walletAddress, vaultAddress) },
      { role: "user", content: userMsg },
    ];

    return streamSSE(c, async (s) => {
      let assistant = "";
      try {
        for await (const chunk of stream(messages)) {
          assistant += chunk;
          await s.writeSSE({ event: "text", data: chunk });
        }
        await s.writeSSE({ event: "done", data: "" });
      } catch (e) {
        await s.writeSSE({ event: "error", data: (e as Error).message });
      }
      try {
        if (assistant) await persist(privyId, userMsg, assistant);
      } catch (err) {
        log.warn({ err }, "chat persist failed (non-blocking)");
      }
    });
  });
  return r;
}

export const chatRouter = makeChatRouter(requireAuth, streamChat);
