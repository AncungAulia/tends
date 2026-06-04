import { env } from "../config/env.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("hermes");

/**
 * Thin client over the Hermes Agent gateway (OpenAI-compatible).
 * Start the sidecar with `hermes gateway` (default http://127.0.0.1:8642/v1).
 * Our custom tools (readUserPosition, prepareWithdrawTx, executeRebalance, ...)
 * are exposed to Hermes as an MCP server — see src/mcp/server.ts — and configured
 * in ~/.hermes/config.yaml, NOT passed in these requests.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Streamed Server-Sent-Events relay for /api/chat. */
export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${env.HERMES_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.HERMES_API_KEY}`,
    },
    body: JSON.stringify({ model: env.HERMES_MODEL, messages, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    log.error({ status: res.status, body }, "hermes chat failed");
    throw new Error(`Hermes gateway error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
}

/** Non-streamed single-shot run — used by cron agents (yield optimizer, risk monitor). */
export async function runAgent(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${env.HERMES_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.HERMES_API_KEY}`,
    },
    body: JSON.stringify({ model: env.HERMES_MODEL, messages, stream: false }),
  });
  if (!res.ok) throw new Error(`Hermes gateway error ${res.status}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}
