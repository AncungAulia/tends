import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { RequestContext } from "@mastra/core/request-context";
import type { Agent } from "@mastra/core/agent";
import { tendsAgent } from "../../agents/mastra/agent.js";
import { actionAgent } from "../../agents/mastra/action-agent.js";
import type { AgentRequestContext } from "../../agents/mastra/tools.js";
import { childLogger } from "../../lib/logger.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { prismaUserResolver, type UserResolver } from "./chat.js";

const log = childLogger("chat-v2");

/**
 * Mastra chat over SSE (Supabase "grow with user" memory + portfolio tools). The
 * `agent` is injected so the same route serves the Hermes read-agent (/api/chat)
 * and the gpt-4o action-agent (/api/chat-v2). Wallet is bound from the Privy session
 * via RequestContext — never the message.
 */
export function makeChatV2Router(
  agent: Agent,
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
    // thread = a single conversation.
    const resource = walletAddress ?? privyId;
    const thread = parsed.data.thread ?? `chat-${resource}`;

    // SECURITY: the wallet the tools act on comes from the authenticated Privy
    // session via RequestContext — NOT from the message — so a prompt-injected
    // message can't make the agent read or mutate another user's account.
    const requestContext = new RequestContext<AgentRequestContext>();
    requestContext.set("walletAddress", walletAddress);

    const grounded = walletAddress
      ? `(I'm signed in${vaultAddress ? " with a deployed vault" : " but have no vault yet"}.)\n\n${parsed.data.message}`
      : parsed.data.message;

    return streamSSE(c, async (s) => {
      try {
        const stream = await agent.stream(grounded, {
          memory: { resource, thread },
          requestContext,
        });
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

/** /api/chat — Hermes read+advisory agent (persona). */
export const chatV2Router = makeChatV2Router(tendsAgent, requireAuth);
/** /api/chat-v2 — gpt-4o action agent (reliably reads AND executes guardrail changes). */
export const actionChatRouter = makeChatV2Router(actionAgent, requireAuth);
