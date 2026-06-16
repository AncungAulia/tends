import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { RequestContext } from "@mastra/core/request-context";
import type { Agent } from "@mastra/core/agent";
import { tendsAgent } from "../../agents/mastra/agent.js";
import { actionAgent } from "../../agents/mastra/action-agent.js";
import type { AgentRequestContext } from "../../agents/mastra/tools.js";
import { tendsMemory } from "../../agents/mastra/memory.js";
import { childLogger } from "../../lib/logger.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { prismaUserResolver, type UserResolver } from "./chat.js";

const log = childLogger("chat-v2");

/**
 * Map a tool result to a rich-card SSE payload, or null if the tool has no card.
 * The FE renders these as a holdings card or a Confirm/Cancel action card.
 * NOTE: Mastra's fullStream tool-result payload shape can vary across versions —
 * we read `result`/`output` defensively so a mismatch just yields no card (no crash).
 */
function toCardEvent(payload: unknown): object | null {
  const p = payload as { toolName?: string; result?: unknown; output?: unknown } | undefined;
  const name = p?.toolName;
  const result = (p?.result ?? p?.output) as Record<string, unknown> | undefined;
  if (!name || !result || typeof result !== "object") return null;

  if (name === "getHoldings" && Array.isArray((result as { holdings?: unknown }).holdings)) {
    return { type: "holdings", holdings: result.holdings, totalValueUsd: result.totalValueUsd };
  }
  if (name === "proposeSwap" && result.outcome === "proposed") {
    return {
      type: "action",
      kind: result.card ?? "move",
      title: result.title,
      subtitle: result.subtitle,
      proposal: result.proposal,
    };
  }
  return null;
}

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
      .object({
        message: z.string().min(1),
        thread: z.string().optional(),
        isNew: z.boolean().optional(),
        title: z.string().optional(),
      })
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

    // If the frontend signals this is a new thread, persist it with a title so it
    // appears in the sessions list with a meaningful name (first 60 chars of message).
    if (parsed.data.isNew && parsed.data.thread) {
      const title = (parsed.data.title ?? parsed.data.message).slice(0, 60);
      try {
        await tendsMemory.createThread({ threadId: thread, resourceId: resource, title });
      } catch (err) {
        log.warn({ err }, "createThread with title failed (non-blocking)");
      }
    }

    // SECURITY: the wallet the tools act on comes from the authenticated Privy
    // session via RequestContext — NOT from the message — so a prompt-injected
    // message can't make the agent read or mutate another user's account.
    const requestContext = new RequestContext<AgentRequestContext>();
    requestContext.set("walletAddress", walletAddress);

    return streamSSE(c, async (s) => {
      try {
        const stream = await agent.stream(parsed.data.message, {
          memory: { resource, thread },
          requestContext,
        });
        for await (const part of stream.fullStream) {
          if (part.type === "text-delta") {
            await s.writeSSE({ event: "text", data: part.payload.text });
          } else if (part.type === "tool-call") {
            // Let the frontend show which tool is running (e.g. "Fetching holdings...")
            await s.writeSSE({ event: "status", data: part.payload.toolName });
          } else if (part.type === "tool-result") {
            // Emit a rich card (holdings / action proposal) from the tool's result.
            const card = toCardEvent(part.payload);
            if (card) await s.writeSSE({ event: "card", data: JSON.stringify(card) });
          }
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
