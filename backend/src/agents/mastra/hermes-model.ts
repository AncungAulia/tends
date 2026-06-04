import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "../../config/env.js";

/**
 * Hermes as a Mastra model — with a FRAME FILTER.
 *
 * The Hermes gateway is not a pure OpenAI-compatible endpoint: alongside standard
 * chat-completion chunks (`data: {choices:[...]}`) it interleaves its own agent UI
 * frames (e.g. `data: {tool:"memory",emoji:"🧠",status:"running"}`). The AI SDK's
 * openai-compatible parser rejects those, aborting the stream. We wrap `fetch` and
 * strip any SSE `data:` line that isn't a valid OpenAI chunk (no `choices`) or
 * `[DONE]`, leaving a clean OpenAI stream for the parser.
 *
 * NOTE: this hides Hermes' own agent activity rather than disabling it — if Hermes
 * runs server-side tools/memory, those still happen, just unseen. Mastra owns the
 * authoritative tools + memory here.
 */
function sseFrameFilter(): TransformStream<string, string> {
  let buf = "";
  const keep = (line: string): boolean => {
    if (!line.startsWith("data:")) return true; // blank lines, comments, event: — keep framing
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return true;
    try {
      return Object.prototype.hasOwnProperty.call(JSON.parse(payload), "choices");
    } catch {
      return false; // non-JSON data frame → drop
    }
  };
  return new TransformStream({
    transform(chunk, controller) {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) if (keep(line)) controller.enqueue(line + "\n");
    },
    flush(controller) {
      if (buf && keep(buf)) controller.enqueue(buf);
    },
  });
}

const filteringFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    return res;
  }
  const filtered = res.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(sseFrameFilter())
    .pipeThrough(new TextEncoderStream());
  return new Response(filtered, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
};

/** Hermes chat model (persona preserved), frames filtered, for use as a Mastra model. */
export const hermesModel = createOpenAICompatible({
  name: "hermes",
  baseURL: env.HERMES_BASE_URL,
  apiKey: env.HERMES_API_KEY,
  fetch: filteringFetch,
}).chatModel(env.HERMES_MODEL);
