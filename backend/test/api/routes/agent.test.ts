import "../../../src/lib/json-bigint.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { makeAgentRouter, type AgentDeps } from "../../../src/api/routes/agent.js";
import { makeAuthMiddleware } from "../../../src/api/auth.js";
import { agentLogEmitter } from "../../../src/services/agent-log-emitter.js";

const VAULT = "0x1111111111111111111111111111111111111111";
const OTHER_VAULT = "0x9999999999999999999999999999999999999999";

// ── SSE helper ────────────────────────────────────────────────────────────────

/** Read up to `count` SSE events from a ReadableStream; cancel and timeout-safe. */
async function readSSE(
  body: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 3000,
): Promise<Array<{ event: string; data: string }>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: Array<{ event: string; data: string }> = [];
  let timerId: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      (async () => {
        while (events.length < count) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.trim()) continue;
            let event = "message";
            let data = "";
            for (const line of part.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(line[5] === " " ? 6 : 5).trim();
            }
            events.push({ event, data });
          }
        }
      })(),
      new Promise<never>(
        (_, reject) => { timerId = setTimeout(() => reject(new Error(`SSE timeout ${timeoutMs}ms`)), timeoutMs); },
      ),
    ]);
  } finally {
    clearTimeout(timerId!);
    reader.cancel().catch(() => {});
  }
  return events;
}

// ── App factory ───────────────────────────────────────────────────────────────

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
    runHermes: async (v) => (rec("runHermes", v), {
      outcome: { action: "rebalanced", hash: "0xdef" },
      reasoning: "Mock: rates favored reallocation",
      allocation: { cmETH: 5000, sUSDe: 3000, mUSD: 2000 },
      attempts: 1,
    }),
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

// ── POST /agent/run-hermes ─────────────────────────────────────────────────────

test("POST /agent/run-hermes: 401 without token", async () => {
  const res = await app().req("/agent/run-hermes", { method: "POST", headers: { authorization: "" } });
  assert.equal(res.status, 401);
});

test("POST /agent/run-hermes: 404 when no vault", async () => {
  const res = await app({}, null).req("/agent/run-hermes", { method: "POST" });
  assert.equal(res.status, 404);
});

test("POST /agent/run-hermes: positive — calls dep and returns result", async () => {
  const { req, calls } = app();
  const res = await req("/agent/run-hermes", { method: "POST" });
  assert.equal(res.status, 200);
  const body = await res.json() as {
    outcome: { action: string; hash?: string };
    reasoning: string;
    allocation: Record<string, number>;
    attempts: number;
  };
  assert.equal(body.outcome.action, "rebalanced");
  assert.ok(typeof body.reasoning === "string" && body.reasoning.length > 0);
  assert.ok(typeof body.allocation === "object");
  assert.equal(body.attempts, 1);
  // dep was called with the vault address
  assert.deepEqual(calls.runHermes?.[0], [VAULT]);
});

test("POST /agent/run-hermes: skip outcome passes through verbatim", async () => {
  const { req } = app({
    runHermes: async () => ({
      outcome: { action: "skip", reason: "cooldown" },
      reasoning: "Still within cooldown window",
      allocation: {},
      attempts: 0,
    }),
  });
  const res = await req("/agent/run-hermes", { method: "POST" });
  assert.equal(res.status, 200);
  const body = await res.json() as { outcome: { action: string; reason: string } };
  assert.equal(body.outcome.action, "skip");
  assert.equal(body.outcome.reason, "cooldown");
});

test("POST /agent/run-hermes: error outcome (model unavailable) passes through", async () => {
  const { req } = app({
    runHermes: async () => ({
      outcome: { action: "skip", reason: "failed" },
      reasoning: "model unavailable",
      allocation: {},
      attempts: 0,
    }),
  });
  const res = await req("/agent/run-hermes", { method: "POST" });
  assert.equal(res.status, 200);
  const body = await res.json() as { outcome: { action: string }; reasoning: string };
  assert.equal(body.outcome.action, "skip");
  assert.ok(body.reasoning.includes("unavailable"));
});

// ── GET /agent/log/stream (SSE) ───────────────────────────────────────────────

test("GET /agent/log/stream: 401 without token", async () => {
  const res = await app().req("/agent/log/stream", { headers: { authorization: "" } });
  assert.equal(res.status, 401);
});

test("GET /agent/log/stream: 404 when no vault", async () => {
  const res = await app({}, null).req("/agent/log/stream");
  assert.equal(res.status, 404);
});

test("GET /agent/log/stream: 200 with text/event-stream content-type", async () => {
  const res = await app().req("/agent/log/stream");
  assert.equal(res.status, 200);
  assert.ok(
    res.headers.get("content-type")?.startsWith("text/event-stream"),
    `expected text/event-stream, got: ${res.headers.get("content-type")}`,
  );
  res.body?.cancel().catch(() => {});
});

test("GET /agent/log/stream: first event is 'connected' with vault address", async () => {
  const res = await app().req("/agent/log/stream");
  assert.equal(res.status, 200);

  const events = await readSSE(res.body!, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.event, "connected");

  const payload = JSON.parse(events[0]!.data) as { vaultAddress: string; ts: string };
  assert.equal(payload.vaultAddress, VAULT.toLowerCase());
  assert.match(payload.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test("GET /agent/log/stream: delivers AgentLogEntry for matching vault", async () => {
  const res = await app().req("/agent/log/stream");
  assert.equal(res.status, 200);

  // Read the connected handshake first, then emit a matching entry
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // drain until connected event lands
  while (!buf.includes("event: connected")) {
    const { done, value } = await reader.read();
    if (done) throw new Error("stream ended before connected");
    buf += decoder.decode(value, { stream: true });
  }
  buf = "";

  // emit entry for our vault
  agentLogEmitter.log({
    vaultAddress: VAULT,
    workflow: "hermes-rebalancer",
    step: "exec-rebalance",
    status: "done",
    message: "sse-delivery-marker",
  });

  // read next event with timeout
  let timerId: ReturnType<typeof setTimeout>;
  let got: string | null = null;
  try {
    await Promise.race([
      (async () => {
        while (got === null) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const dl = part.split("\n").find((l) => l.startsWith("data:"));
            if (dl) { got = dl.slice(dl[5] === " " ? 6 : 5).trim(); return; }
          }
        }
      })(),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("timeout waiting for entry")), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timerId!);
    reader.cancel().catch(() => {});
  }

  assert.ok(got, "expected a data line in the stream");
  const entry = JSON.parse(got!) as { message: string; vaultAddress: string; workflow: string };
  assert.equal(entry.message, "sse-delivery-marker");
  assert.equal(entry.vaultAddress, VAULT);
  assert.equal(entry.workflow, "hermes-rebalancer");
});

test("GET /agent/log/stream: filters out entries for a different vault", async () => {
  const res = await app().req("/agent/log/stream");
  assert.equal(res.status, 200);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // drain until connected
  while (!buf.includes("event: connected")) {
    const { done, value } = await reader.read();
    if (done) throw new Error("stream ended before connected");
    buf += decoder.decode(value, { stream: true });
  }
  buf = "";

  // emit wrong-vault first, then right-vault so we know when stream has caught up
  agentLogEmitter.log({ vaultAddress: OTHER_VAULT, workflow: "w", step: "s", status: "done", message: "filtered-out" });
  agentLogEmitter.log({ vaultAddress: VAULT, workflow: "w", step: "s", status: "done", message: "allowed-through" });

  // collect until "allowed-through" arrives or timeout
  const received: string[] = [];
  let timerId: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      (async () => {
        while (!received.includes("allowed-through")) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const dl = part.split("\n").find((l) => l.startsWith("data:"));
            if (dl) {
              try {
                const e = JSON.parse(dl.slice(dl[5] === " " ? 6 : 5).trim()) as { message: string };
                received.push(e.message);
              } catch { /* ignore non-JSON lines */ }
            }
          }
        }
      })(),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("timeout")), 3000);
      }),
    ]);
  } finally {
    clearTimeout(timerId!);
    reader.cancel().catch(() => {});
  }

  assert.ok(received.includes("allowed-through"), "matching vault entry should arrive");
  assert.ok(!received.includes("filtered-out"), "other vault entry must be filtered");
});
