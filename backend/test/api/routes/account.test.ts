import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { makeAuthRouter } from "../../../src/api/routes/auth.js";
import { makeApyRouter, type ApyReader } from "../../../src/api/routes/apy.js";
import { makeChatRouter, buildSystemPrompt } from "../../../src/api/routes/chat.js";
import type { ChatMessage } from "../../../src/agents/hermes-client.js";
import { makeAuthMiddleware } from "../../../src/api/auth.js";

const okAuth = makeAuthMiddleware(async (t) => {
  if (t === "good") return { privyId: "did:privy:1" };
  throw new Error("bad");
});
const WALLET = "0x00000000000000000000000000000000000000bb";

// ── /api/auth/verify ─────────────────────────────────────────────────────────
test("POST /api/auth/verify: upserts user from verified session", async () => {
  const calls: { privyId: string; wallet: string }[] = [];
  const app = new Hono().route(
    "/api/auth",
    makeAuthRouter(okAuth, async (privyId, wallet) => void calls.push({ privyId, wallet })),
  );
  const verify = (token: string, body?: unknown) =>
    app.request("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  assert.equal((await verify("bad", { walletAddress: WALLET })).status, 401);
  assert.equal((await verify("good", { walletAddress: "0xnope" })).status, 400);

  const ok = await verify("good", { walletAddress: WALLET });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, [{ privyId: "did:privy:1", wallet: WALLET }]);
});

// ── /api/apy/history ─────────────────────────────────────────────────────────
test("GET /api/apy/history: validates params and calls the reader", async () => {
  const seen: { asset: string; days: number }[] = [];
  const reader: ApyReader = {
    history: async (asset, days) => {
      seen.push({ asset, days });
      return [{ asset, apy: 5 }];
    },
  };
  const app = new Hono().route("/api/apy", makeApyRouter(reader));

  assert.equal((await app.request("/api/apy/history")).status, 400); // no asset
  assert.equal((await app.request("/api/apy/history?asset=mETH&days=0")).status, 400);

  const ok = await app.request("/api/apy/history?asset=mETH&days=7");
  assert.equal(ok.status, 200);
  assert.deepEqual(seen, [{ asset: "mETH", days: 7 }]);
});

// ── chat grounding ───────────────────────────────────────────────────────────
test("buildSystemPrompt: grounds 'vault' as on-chain + injects wallet/vault", () => {
  const p = buildSystemPrompt("0xWALLET", "0xVAULT");
  assert.match(p, /on-chain ERC-4626 RWA vault/);
  assert.match(p, /NEVER a secrets\/file\/password vault/);
  assert.match(p, /0xWALLET/);
  assert.match(p, /0xVAULT/);
  assert.match(p, /readUserPosition/);
  assert.match(buildSystemPrompt(null, null), /has not linked a wallet/);
});

test("POST /api/chat: prepends a grounding system prompt with the resolved wallet", async () => {
  let captured: ChatMessage[] = [];
  async function* capture(messages: ChatMessage[]) {
    captured = messages;
    yield "ok";
  }
  const resolveUser = async () => ({ walletAddress: "0xWALLET", vaultAddress: "0xVAULT" });
  const app = new Hono().route("/api/chat", makeChatRouter(okAuth, capture, async () => {}, resolveUser));
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer good" },
    body: JSON.stringify({ message: "what's in my vault?" }),
  });
  await res.text(); // drain the stream
  assert.equal(captured[0]!.role, "system");
  assert.match(captured[0]!.content, /0xWALLET/);
  assert.match(captured[0]!.content, /0xVAULT/);
  assert.equal(captured[1]!.role, "user");
  assert.equal(captured[1]!.content, "what's in my vault?");
});

// ── /api/chat (SSE) ──────────────────────────────────────────────────────────
test("POST /api/chat: auth + body validation + streamed SSE chunks", async () => {
  async function* fakeStream() {
    yield "Hel";
    yield "lo";
  }
  const persisted: { privyId: string; user: string; assistant: string }[] = [];
  const persist = async (privyId: string, user: string, assistant: string) =>
    void persisted.push({ privyId, user, assistant });
  const app = new Hono().route("/api/chat", makeChatRouter(okAuth, fakeStream, persist));
  const post = (token: string, body?: unknown) =>
    app.request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  assert.equal((await post("bad", { message: "hi" })).status, 401);
  assert.equal((await post("good", { message: "" })).status, 400);

  const res = await post("good", { message: "hi" });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /data: Hel/);
  assert.match(text, /data: lo/);
  assert.match(text, /event: done/);

  // the completed exchange is persisted with the accumulated reply
  assert.deepEqual(persisted, [{ privyId: "did:privy:1", user: "hi", assistant: "Hello" }]);
});

test("POST /api/chat: a stream error emits an SSE error event (no persist)", async () => {
  async function* boom() {
    throw new Error("llm down");
    yield ""; // unreachable; makes this a generator
  }
  const persisted: unknown[] = [];
  const app = new Hono().route(
    "/api/chat",
    makeChatRouter(okAuth, boom, async (...a) => void persisted.push(a)),
  );
  const res = await app.request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer good" },
    body: JSON.stringify({ message: "hi" }),
  });
  assert.equal(res.status, 200); // SSE opened
  const text = await res.text();
  assert.match(text, /event: error/);
  assert.match(text, /llm down/);
  assert.equal(persisted.length, 0); // nothing to persist on failure
});
