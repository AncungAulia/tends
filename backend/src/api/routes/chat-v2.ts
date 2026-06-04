import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { tendsAgent } from "../../agents/mastra/agent.js";
import { childLogger } from "../../lib/logger.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { prismaUserResolver, type UserResolver } from "./chat.js";

const log = childLogger("chat-v2");

/**
 * POST /api/chat-v2 — PoC chat over the Mastra agent (Hermes model + Supabase
 * memory), running PARALLEL to the Hermes-MCP /api/chat. Conversation history +
 * the per-user "grow with user" working memory are persisted by Mastra Memory; no
 * manual ChatMessage write here.
 */
export function makeChatV2Router(
  auth: MiddlewareHandler<AuthVars>,
  resolveUser: UserResolver = prismaUserResolver,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.post("/", auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({ message: z.string().min(1), thread: z.string().optional() })
      .safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const privyId = c.get("privyId");
    let walletAddress: string | null = null;
    let vaultAddress: string | null = null;
    try {
      ({ walletAddress, vaultAddress } = await resolveUser(privyId));
    } catch (err) {
      log.warn({ err }, "user resolve failed — chatting without wallet grounding");
    }

    // resource = the user (wallet → memory grows with user across sessions);
    // thread = a single conversation. Wallet grounding is injected per message so
    // the agent knows which address to pass to readUserPosition.
    const resource = walletAddress ?? privyId;
    const thread = parsed.data.thread ?? `chat-${resource}`;
    const grounded = walletAddress
      ? `(My wallet is ${walletAddress}${vaultAddress ? `, vault ${vaultAddress}` : ", no vault deployed yet"}.)\n\n${parsed.data.message}`
      : parsed.data.message;

    return streamSSE(c, async (s) => {
      try {
        const stream = await tendsAgent.stream(grounded, { memory: { resource, thread } });
        for await (const chunk of stream.textStream) {
          await s.writeSSE({ event: "text", data: chunk });
        }
        await s.writeSSE({ event: "done", data: "" });
      } catch (e) {
        log.error({ err: e }, "chat-v2 stream failed");
        await s.writeSSE({ event: "error", data: (e as Error).message });
      }
    });
  });
  return r;
}

export const chatV2Router = makeChatV2Router(requireAuth);
