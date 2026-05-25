import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { streamChat, type ChatMessage } from "../../agents/hermes-client.js";
import { requireAuth, type AuthVars } from "../auth.js";

export type ChatStream = (messages: ChatMessage[]) => AsyncGenerator<string>;

/** POST /api/chat — SSE relay of the Hermes assistant's streamed reply. */
export function makeChatRouter(
  auth: MiddlewareHandler<AuthVars>,
  stream: ChatStream,
): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.post("/", auth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = z.object({ message: z.string().min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid body" }, 400);

    const messages: ChatMessage[] = [{ role: "user", content: parsed.data.message }];
    return streamSSE(c, async (s) => {
      try {
        for await (const chunk of stream(messages)) {
          await s.writeSSE({ event: "text", data: chunk });
        }
        await s.writeSSE({ event: "done", data: "" });
      } catch (e) {
        await s.writeSSE({ event: "error", data: (e as Error).message });
      }
    });
  });
  return r;
}

export const chatRouter = makeChatRouter(requireAuth, streamChat);
