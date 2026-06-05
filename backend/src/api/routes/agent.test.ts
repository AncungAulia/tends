import "../../lib/json-bigint.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { makeAgentRouter, type AgentDeps } from "./agent.js";
import { makeAuthMiddleware } from "../auth.js";

const VAULT = "0x1111111111111111111111111111111111111111";

function app(over: Partial<AgentDeps> = {}, vaultAddress: string | null = VAULT) {
  const calls: Record<string, unknown[]> = {};
  const rec = (k: string, ...args: unknown[]) => {
    (calls[k] ??= []).push(args);
  };
  const deps: AgentDeps = {
    resolveVault: async () => ({ vaultAddress, initialDeposit: "1000000000" }), // $1000 (6-dec)
    getConfig: async (v) => (rec("getConfig", v), { vaultAddress: v, autoRebalanceEnabled: true }),
    saveConfig: async (v, patch) => (rec("saveConfig", v, patch), { vaultAddress: v, ...patch }),
    setPause: async (v, enabled) => (rec("setPause", v, enabled), { vaultAddress: v, autoRebalanceEnabled: enabled }),
    runNow: async (v) => (rec("runNow", v), { action: "rebalanced", hash: "0xabc", swaps: 2 }),
    agentLog: async (v, limit) => (rec("agentLog", v, limit), [{ action: "REBALANCE" }]),
    holdings: async (v) => (rec("holdings", v), { holdings: [{ symbol: "cmETH" }], totalValueUsd: "1100" }),
    getPrefs: async () => ({ theme: "dark" }),
    savePrefs: async (id, prefs) => (rec("savePrefs", id, prefs), prefs),
    ...over,
  };
  const auth = makeAuthMiddleware(async (t) => {
    if (t === "good") return { privyId: "did:privy:1" };
    throw new Error("bad");
  });
  const a = new Hono().route("/api/users/me", makeAgentRouter(deps, auth));
  const req = (path: string, init?: RequestInit) =>
    a.request("/api/users/me" + path, {
      ...init,
      headers: { authorization: "Bearer good", "content-type": "application/json", ...init?.headers },
    });
  return { req, calls };
}

test("agent routes: require auth (401 without token)", async () => {
  const { req } = app();
  const res = await req("/agent-config", { headers: { authorization: "" } });
  assert.equal(res.status, 401);
});

test("GET /agent-config returns config; 404 when no vault", async () => {
  assert.equal((await app().req("/agent-config")).status, 200);
  assert.equal((await app({}, null).req("/agent-config")).status, 404);
});

test("POST /agent-config: valid patch saved; invalid → 400", async () => {
  const { req, calls } = app();
  const ok = await req("/agent-config", {
    method: "POST",
    body: JSON.stringify({ maxSlippageBps: 200, perTokenCapsBps: { sUSDe: 4000 } }),
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls.saveConfig?.[0], [VAULT, { maxSlippageBps: 200, perTokenCapsBps: { sUSDe: 4000 } }]);

  const bad = await req("/agent-config", {
    method: "POST",
    body: JSON.stringify({ maxSlippageBps: 99999 }),
  });
  assert.equal(bad.status, 400);
});

test("PATCH /agent/pause + resume toggle autoRebalance", async () => {
  const { req, calls } = app();
  await req("/agent/pause", { method: "PATCH" });
  await req("/agent/resume", { method: "PATCH" });
  assert.deepEqual(calls.setPause, [[VAULT, false], [VAULT, true]]);
});

test("POST /agent/run-now triggers a manual rebalance", async () => {
  const { req, calls } = app();
  const res = await req("/agent/run-now", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as { action: string }).action, "rebalanced");
  assert.deepEqual(calls.runNow?.[0], [VAULT]);
});

test("GET /portfolio composes value + PnL from holdings + cost basis", async () => {
  const res = await app().req("/portfolio");
  const p = (await res.json()) as { totalValueUsd: number; initialDepositUsd: number; pnlUsd: number; pnlPct: number };
  assert.equal(p.totalValueUsd, 1100);
  assert.equal(p.initialDepositUsd, 1000);
  assert.equal(p.pnlUsd, 100);
  assert.equal(p.pnlPct, 10);
});

test("GET /holdings + /agent-log + preferences round-trip", async () => {
  const { req, calls } = app();
  assert.equal((await req("/holdings")).status, 200);
  const log = (await (await req("/agent-log?limit=5")).json()) as { activities: unknown[] };
  assert.equal(log.activities.length, 1);
  assert.deepEqual(calls.agentLog?.[0], [VAULT, 5]);

  const prefs = await (await req("/preferences", { method: "PUT", body: JSON.stringify({ theme: "light" }) })).json();
  assert.deepEqual(prefs, { theme: "light" });
});
