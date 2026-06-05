import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAgentConfig, DEFAULT_AGENT_CONFIG } from "./agent-config.js";

test("validateAgentConfig: passes a valid full patch through", () => {
  const patch = {
    autoRebalanceEnabled: false,
    cadenceSec: 7200,
    driftThresholdBps: 250,
    maxSlippageBps: 150,
    perTokenCapsBps: { sUSDe: 4000, cmETH: 3000 } as Record<string, number>,
    notes: "keep me conservative",
  };
  assert.deepEqual(validateAgentConfig(patch), patch);
});

test("validateAgentConfig: only includes provided keys (partial patch)", () => {
  assert.deepEqual(validateAgentConfig({ maxSlippageBps: 200 }), { maxSlippageBps: 200 });
  assert.deepEqual(validateAgentConfig({}), {});
});

test("validateAgentConfig: allows explicit null to clear optional fields", () => {
  assert.deepEqual(validateAgentConfig({ cadenceSec: null, perTokenCapsBps: null, notes: null }), {
    cadenceSec: null,
    perTokenCapsBps: null,
    notes: null,
  });
});

test("validateAgentConfig: rejects out-of-range + unknown token + long notes", () => {
  assert.throws(() => validateAgentConfig({ driftThresholdBps: 20_000 }), /driftThresholdBps/);
  assert.throws(() => validateAgentConfig({ maxSlippageBps: -1 }), /maxSlippageBps/);
  assert.throws(() => validateAgentConfig({ cadenceSec: 1.5 }), /cadenceSec/);
  assert.throws(
    () => validateAgentConfig({ perTokenCapsBps: { NOPE: 100 } as Record<string, number> }),
    /unknown token/,
  );
  assert.throws(
    () => validateAgentConfig({ perTokenCapsBps: { sUSDe: 99_999 } as Record<string, number> }),
    /cap for sUSDe/,
  );
  assert.throws(() => validateAgentConfig({ notes: "x".repeat(1001) }), /notes/);
});

test("DEFAULT_AGENT_CONFIG: auto-rebalance on, 1% slippage, no caps", () => {
  assert.equal(DEFAULT_AGENT_CONFIG.autoRebalanceEnabled, true);
  assert.equal(DEFAULT_AGENT_CONFIG.maxSlippageBps, 100);
  assert.equal(DEFAULT_AGENT_CONFIG.perTokenCapsBps, null);
});
