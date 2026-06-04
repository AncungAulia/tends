import { test } from "node:test";
import assert from "node:assert/strict";
import { streamChat, runAgent } from "./hermes-client.js";

const realFetch = globalThis.fetch;

function sseResponse(text: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return { ok: true, body } as unknown as Response;
}

test("streamChat: parses SSE deltas and stops at [DONE]", async () => {
  globalThis.fetch = (async () =>
    sseResponse(
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n' +
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n' +
        "data: [DONE]\n" +
        'data: {"choices":[{"delta":{"content":"ignored"}}]}\n',
    )) as typeof fetch;
  try {
    const chunks: string[] = [];
    for await (const c of streamChat([{ role: "user", content: "hi" }])) chunks.push(c);
    assert.deepEqual(chunks, ["Hel", "lo"]); // stops at [DONE], ignores after
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("streamChat: throws on a non-ok response", async () => {
  globalThis.fetch = (async () => ({ ok: false, status: 500, text: async () => "boom", body: null }) as unknown as Response) as typeof fetch;
  try {
    await assert.rejects(async () => {
      for await (const _ of streamChat([{ role: "user", content: "hi" }])) void _;
    }, /Hermes gateway error 500/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("runAgent: returns the assistant message content", async () => {
  globalThis.fetch = (async () =>
    ({ ok: true, json: async () => ({ choices: [{ message: { content: "pong" } }] }) }) as unknown as Response) as typeof fetch;
  try {
    assert.equal(await runAgent([{ role: "user", content: "ping" }]), "pong");
  } finally {
    globalThis.fetch = realFetch;
  }
});
