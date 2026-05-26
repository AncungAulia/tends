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

/** Default: store user+assistant turns once the user is linked to a wallet. */
export const prismaChatPersist: ChatPersist = async (privyId, userMsg, assistantMsg) => {
  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) return; // not linked yet (/auth/verify not called) — nothing to attach to
  await prisma.chatMessage.createMany({
    data: [
      { walletAddress: user.walletAddress, role: "user", content: userMsg },
      { walletAddress: user.walletAddress, role: "assistant", content: assistantMsg },
    ],
  });
};

/** POST /api/chat — SSE relay of the Hermes assistant reply; persists the exchange. */
export function makeChatRouter(
  auth: MiddlewareHandler<AuthVars>,
  stream: ChatStream,
  persist: ChatPersist = prismaChatPersist,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.post("/", auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ message: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const privyId = c.get("privyId");
    const userMsg = parsed.data.message;
    const messages: ChatMessage[] = [{ role: "user", content: userMsg }];

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
      // persist the completed turn (best-effort — never breaks the response)
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
