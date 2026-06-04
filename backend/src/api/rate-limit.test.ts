import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { RateLimiter, makeRateLimit } from "./rate-limit.js";

test("RateLimiter: allows up to max, then blocks within the window", () => {
  const rl = new RateLimiter(3, 1000);
  assert.equal(rl.hit("a", 0).allowed, true); // 1
  assert.equal(rl.hit("a", 10).allowed, true); // 2
  const third = rl.hit("a", 20);
  assert.equal(third.allowed, true); // 3
  assert.equal(third.remaining, 0);
  assert.equal(rl.hit("a", 30).allowed, false); // 4 → blocked
});

test("RateLimiter: window reset re-allows; keys are independent", () => {
  const rl = new RateLimiter(1, 1000);
  assert.equal(rl.hit("a", 0).allowed, true);
  assert.equal(rl.hit("a", 500).allowed, false); // still in window
  assert.equal(rl.hit("a", 1000).allowed, true); // window elapsed
  assert.equal(rl.hit("b", 1000).allowed, true); // separate key
});

test("middleware: returns 429 past the limit, with headers", async () => {
  const app = new Hono();
  app.use("*", makeRateLimit(new RateLimiter(2, 60_000)));
  app.get("/", (c) => c.text("ok"));
  const req = () => app.request("/", { headers: { "x-forwarded-for": "1.2.3.4" } });

  assert.equal((await req()).status, 200);
  assert.equal((await req()).status, 200);
  const blocked = await req();
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
  // a different IP is unaffected
  assert.equal((await app.request("/", { headers: { "x-forwarded-for": "5.6.7.8" } })).status, 200);
});
