import { Hono } from "hono";
import { tendsMemory } from "../../agents/mastra/memory.js";
import { requireAuth, type AuthVars } from "../auth.js";
import { prismaUserResolver } from "./chat.js";
import { childLogger } from "../../lib/logger.js";

const log = childLogger("chat-sessions");

type TextPart = { type: string; text?: unknown };

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const c = content as { content?: unknown; parts?: unknown };
    if (typeof c.content === "string") return c.content;
    if (Array.isArray(c.parts)) {
      return (c.parts as TextPart[])
        .filter((p) => p?.type === "text" && typeof p.text === "string")
        .map((p) => String(p.text))
        .join("");
    }
  }
  return "";
}

const r = new Hono<AuthVars>();

// GET /api/chat-sessions — list sessions for the authenticated user
r.get("/", requireAuth, async (c) => {
  const privyId = c.get("privyId");
  let walletAddress: string | null = null;
  try {
    ({ walletAddress } = await prismaUserResolver(privyId));
  } catch {
    // proceed without wallet grounding
  }
  const resource = walletAddress ?? privyId;

  try {
    const { threads } = await tendsMemory.listThreads({
      filter: { resourceId: resource },
      orderBy: { field: "updatedAt", direction: "DESC" },
      perPage: false,
    });
    return c.json({
      sessions: threads.map((t) => ({
        id: t.id,
        title: t.title ?? "New Chat",
        updatedAt: t.updatedAt,
      })),
    });
  } catch (err) {
    log.error({ err }, "listThreads failed");
    return c.json({ sessions: [] });
  }
});

// GET /api/chat-sessions/:threadId — get messages for a session (for loading history)
r.get("/:threadId", requireAuth, async (c) => {
  const threadId = c.req.param("threadId");
  try {
    const { messages } = await tendsMemory.recall({ threadId, perPage: false });
    const ui = (messages as Array<{ role?: string; content?: unknown }>)
      .map((m) => ({
        role: (m.role === "user" ? "user" : "hermes") as "user" | "hermes",
        text: extractText(m.content).trim(),
      }))
      .filter((m) => m.text.length > 0);
    return c.json({ messages: ui });
  } catch (err) {
    log.error({ err }, "recall failed");
    return c.json({ messages: [] });
  }
});

// DELETE /api/chat-sessions/:threadId — delete a session
r.delete("/:threadId", requireAuth, async (c) => {
  const threadId = c.req.param("threadId");
  try {
    await tendsMemory.deleteThread(threadId);
    return c.json({ ok: true });
  } catch (err) {
    log.error({ err }, "deleteThread failed");
    return c.json({ error: "delete failed" }, 500);
  }
});

export { r as chatSessionsRouter };
