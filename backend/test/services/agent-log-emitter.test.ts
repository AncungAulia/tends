import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { agentLogEmitter, type AgentLogEntry, type LogStatus } from "../../src/services/agent-log-emitter.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function collect(count: number): { entries: AgentLogEntry[]; cleanup: () => void } {
  const entries: AgentLogEntry[] = [];
  const handler = (e: AgentLogEntry) => entries.push(e);
  agentLogEmitter.on("entry", handler);
  return {
    entries,
    cleanup: () => agentLogEmitter.off("entry", handler),
  };
}

// ── Positive tests ─────────────────────────────────────────────────────────────

test("emitter: log() assigns a unique id and ISO timestamp", () => {
  const { entries, cleanup } = collect(1);
  agentLogEmitter.log({
    vaultAddress: "0xABC",
    workflow: "hermes-rebalancer",
    step: "scan-vault",
    status: "running",
    message: "Scanning...",
  });
  cleanup();
  assert.equal(entries.length, 1);
  const e = entries[0]!;
  assert.match(e.id, /^[0-9a-f-]{36}$/);            // UUID v4
  assert.match(e.ts, /^\d{4}-\d{2}-\d{2}T/);        // ISO datetime
  assert.equal(e.status, "running");
  assert.equal(e.message, "Scanning...");
});

test("emitter: multiple listeners all receive the same entry", () => {
  const received: AgentLogEntry[][] = [[], []];
  const h1 = (e: AgentLogEntry) => received[0]!.push(e);
  const h2 = (e: AgentLogEntry) => received[1]!.push(e);
  agentLogEmitter.on("entry", h1);
  agentLogEmitter.on("entry", h2);

  agentLogEmitter.log({ vaultAddress: "0xVAULT", workflow: "w", step: "s", status: "done", message: "m" });

  agentLogEmitter.off("entry", h1);
  agentLogEmitter.off("entry", h2);

  assert.equal(received[0]!.length, 1);
  assert.equal(received[1]!.length, 1);
  // Same object (same id)
  assert.equal(received[0]![0]!.id, received[1]![0]!.id);
});

test("emitter: each call to log() produces a distinct id", () => {
  const { entries, cleanup } = collect(3);
  for (let i = 0; i < 3; i++) {
    agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status: "running", message: `msg${i}` });
  }
  cleanup();
  const ids = entries.map((e) => e.id);
  assert.equal(new Set(ids).size, 3, "all ids must be unique");
});

test("emitter: optional data field is passed through", () => {
  const { entries, cleanup } = collect(1);
  agentLogEmitter.log({
    vaultAddress: "0x1",
    workflow: "hermes-rebalancer",
    step: "decide-allocation",
    status: "done",
    message: "Hermes decided",
    data: { reasoning: "Low rate environment", allocation: { mUSD: 60 } },
  });
  cleanup();
  assert.deepEqual(entries[0]!.data, { reasoning: "Low rate environment", allocation: { mUSD: 60 } });
});

test("emitter: data field absent when not provided", () => {
  const { entries, cleanup } = collect(1);
  agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status: "skip", message: "m" });
  cleanup();
  assert.equal(entries[0]!.data, undefined);
});

// ── Status values ──────────────────────────────────────────────────────────────

const STATUSES: LogStatus[] = ["running", "done", "skip", "error"];

test("emitter: all four status values are accepted", () => {
  const { entries, cleanup } = collect(4);
  for (const status of STATUSES) {
    agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status, message: "m" });
  }
  cleanup();
  assert.deepEqual(entries.map((e) => e.status).sort(), [...STATUSES].sort());
});

// ── Isolation — removing a listener stops delivery to that handler ─────────────

test("emitter: off() stops delivery to the removed handler only", () => {
  const received1: AgentLogEntry[] = [];
  const received2: AgentLogEntry[] = [];
  const h1 = (e: AgentLogEntry) => received1.push(e);
  const h2 = (e: AgentLogEntry) => received2.push(e);

  agentLogEmitter.on("entry", h1);
  agentLogEmitter.on("entry", h2);
  agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status: "done", message: "first" });

  agentLogEmitter.off("entry", h1); // remove only h1
  agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status: "done", message: "second" });

  agentLogEmitter.off("entry", h2);

  assert.equal(received1.length, 1, "h1 stopped after off()");
  assert.equal(received2.length, 2, "h2 kept receiving");
  assert.equal(received2[0]!.message, "first");
  assert.equal(received2[1]!.message, "second");
});

// ── maxListeners guard ─────────────────────────────────────────────────────────

test("emitter: maxListeners is 200 (no spurious memory-leak warning)", () => {
  assert.equal(agentLogEmitter.getMaxListeners(), 200);
});

// ── Negative / edge cases ──────────────────────────────────────────────────────

test("emitter: no listeners → log() does not throw", () => {
  // Save and remove all existing listeners temporarily
  const listeners = agentLogEmitter.rawListeners("entry") as ((...args: unknown[]) => void)[];
  for (const l of listeners) agentLogEmitter.removeListener("entry", l);

  assert.doesNotThrow(() =>
    agentLogEmitter.log({ vaultAddress: "0x0", workflow: "w", step: "s", status: "done", message: "solo" }),
  );

  // Restore
  for (const l of listeners) agentLogEmitter.on("entry", l);
});

test("emitter: empty message string is accepted", () => {
  const { entries, cleanup } = collect(1);
  agentLogEmitter.log({ vaultAddress: "0x1", workflow: "w", step: "s", status: "running", message: "" });
  cleanup();
  assert.equal(entries[0]!.message, "");
});

test("emitter: vaultAddress is passed through verbatim (case-insensitive callers must normalise themselves)", () => {
  const mixed = "0xDeAdBeEf";
  const { entries, cleanup } = collect(1);
  agentLogEmitter.log({ vaultAddress: mixed, workflow: "w", step: "s", status: "done", message: "m" });
  cleanup();
  assert.equal(entries[0]!.vaultAddress, mixed);
});

test("emitter: is an EventEmitter instance", () => {
  assert.ok(agentLogEmitter instanceof EventEmitter);
});
