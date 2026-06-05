import "../../../src/lib/json-bigint.js"; // so responses carrying Prisma BigInt serialize
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { strategiesRouter } from "../../../src/api/routes/strategies.js";
import { projectionRouter } from "../../../src/api/routes/projection.js";
import { makeUsersRouter, type UserReader } from "../../../src/api/routes/users.js";
import { makeAuthMiddleware } from "../../../src/api/auth.js";

// ── /api/strategies ──────────────────────────────────────────────────────────
const stratApp = new Hono().route("/api/strategies", strategiesRouter);

test("GET /api/strategies lists all four", async () => {
  const res = await stratApp.request("/api/strategies");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { strategies: { id: string }[] };
  assert.equal(body.strategies.length, 4);
});

test("GET /api/strategies/:id — found and 404", async () => {
  const ok = await stratApp.request("/api/strategies/low"); // case-insensitive
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as { id: string }).id, "LOW");

  const miss = await stratApp.request("/api/strategies/wat");
  assert.equal(miss.status, 404);
});

// ── /api/projection ──────────────────────────────────────────────────────────
const projApp = new Hono().route("/api/projection", projectionRouter);
const post = (body: unknown) =>
  projApp.request("/api/projection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("POST /api/projection: valid LOW returns base/best/worst", async () => {
  const res = await post({ strategyId: "LOW", capital: 1000, durationDays: 365 });
  assert.equal(res.status, 200);
  const p = (await res.json()) as { base: number; best: number; worst: number };
  assert.ok(p.best >= p.base && p.base >= p.worst);
});

test("POST /api/projection: invalid body → 400", async () => {
  assert.equal((await post({ strategyId: "LOW", capital: -5, durationDays: 30 })).status, 400);
  assert.equal((await post({ strategyId: "ZZZ", capital: 100, durationDays: 30 })).status, 400);
  assert.equal((await post({ capital: 100, durationDays: 30 })).status, 400);
});

test("POST /api/projection: CUSTOM requires a valid allocation", async () => {
  assert.equal((await post({ strategyId: "CUSTOM", capital: 100, durationDays: 30 })).status, 400);
  // bad sum
  assert.equal(
    (await post({
      strategyId: "CUSTOM",
      capital: 100,
      durationDays: 30,
      customAllocation: { lowBps: 5000, medBps: 4000, highBps: 0 },
    })).status,
    400,
  );
  // valid
  assert.equal(
    (await post({
      strategyId: "CUSTOM",
      capital: 100,
      durationDays: 30,
      customAllocation: { lowBps: 5000, medBps: 3000, highBps: 2000 },
    })).status,
    200,
  );
});

// ── /api/users/me (auth-gated) ───────────────────────────────────────────────
function usersApp(reader: UserReader) {
  const auth = makeAuthMiddleware(async (t) => {
    if (t === "good") return { privyId: "did:privy:1" };
    throw new Error("bad");
  });
  return new Hono().route("/api/users/me", makeUsersRouter(reader, auth));
}

test("GET /api/users/me/position: 401 without/with bad token, 200 with good", async () => {
  const seen: string[] = [];
  const reader: UserReader = {
    getPosition: async (id) => {
      seen.push(id);
      return { vault: null };
    },
    getActivity: async () => ({ activities: [] }),
    getPnl: async () => ({ vault: null, initialDepositUsd: 0, points: [] }),
  };
  const app = usersApp(reader);

  assert.equal((await app.request("/api/users/me/position")).status, 401);
  assert.equal(
    (await app.request("/api/users/me/position", { headers: { authorization: "Bearer bad" } })).status,
    401,
  );
  const ok = await app.request("/api/users/me/position", {
    headers: { authorization: "Bearer good" },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(seen, ["did:privy:1"]); // privyId from the verified token
});

test("GET /api/users/me/position: serializes Prisma BigInt fields (no 500)", async () => {
  const reader: UserReader = {
    getPosition: async () => ({ vault: { address: "0xabc", deployedBlock: 12345n } }),
    getActivity: async () => ({ activities: [{ id: 99n, blockNumber: null }] }),
    getPnl: async () => ({ vault: "0xabc", initialDepositUsd: 100, points: [] }),
  };
  const app = usersApp(reader);
  const pos = await app.request("/api/users/me/position", { headers: { authorization: "Bearer good" } });
  assert.equal(pos.status, 200);
  assert.equal(((await pos.json()) as { vault: { deployedBlock: unknown } }).vault.deployedBlock, "12345");

  const act = await app.request("/api/users/me/activity", { headers: { authorization: "Bearer good" } });
  assert.equal(act.status, 200);
  assert.equal(((await act.json()) as { activities: { id: unknown }[] }).activities[0]!.id, "99");
});
