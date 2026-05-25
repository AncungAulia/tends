import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { makeAuthRouter } from "./auth.js";
import { makeApyRouter, type ApyReader } from "./apy.js";
import { makeChatRouter } from "./chat.js";
import { makeAuthMiddleware } from "../auth.js";

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
