import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RebalancerService,
  type RebalancerDeps,
  type VaultMeta,
} from "./rebalancer.js";
import type { SwapInstruction } from "./rebalance-math.js";
import { DEFAULT_AGENT_CONFIG, type AgentConfigValue } from "./agent-config.js";

const cfg = (o: Partial<AgentConfigValue> = {}): AgentConfigValue => ({
  vaultAddress: "0x0",
  ...DEFAULT_AGENT_CONFIG,
  ...o,
});

const V1 = "0x0000000000000000000000000000000000000001" as const;
const V2 = "0x0000000000000000000000000000000000000002" as const;
const SWAP: SwapInstruction = {
  tokenIn: "0x00000000000000000000000000000000000000aa",
  tokenOut: "0x00000000000000000000000000000000000000bb",
  amountIn: 1n,
  minAmountOut: 1n,
};

const meta = (o: Partial<VaultMeta> = {}): VaultMeta => ({
  paused: false,
  lastRebalanceTime: 0n,
  minRebalanceInterval: 0n,
  riskPreference: 1,
  ...o,
});

function makeDeps(over: Partial<RebalancerDeps> = {}) {
  const calls = { sendRebalance: [] as { vault: string; instr: SwapInstruction[] }[] };
  const deps: RebalancerDeps = {
    listVaults: async () => [V1],
    readVaultMeta: async () => meta(),
    arePricesFresh: async () => true,
    readAgentConfig: async () => cfg(),
    buildInstructions: async () => [SWAP],
    simulateRebalance: async () => true,
    sendRebalance: async (vault, instr) => {
      calls.sendRebalance.push({ vault, instr });
      return "0xhash";
    },
    now: () => 1000n,
    ...over,
  };
  return { deps, calls };
}

test("processVault: paused → skip, no tx sent", async () => {
  const { deps, calls } = makeDeps({ readVaultMeta: async () => meta({ paused: true }) });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "paused" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: auto-rebalance disabled by user → skip, no tx", async () => {
  const { deps, calls } = makeDeps({ readAgentConfig: async () => cfg({ autoRebalanceEnabled: false }) });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "disabled" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: off-chain cadence not elapsed → skip", async () => {
  const { deps, calls } = makeDeps({
    readVaultMeta: async () => meta({ lastRebalanceTime: 900n, minRebalanceInterval: 0n }),
    readAgentConfig: async () => cfg({ cadenceSec: 200 }), // 1000 < 900+200
    now: () => 1000n,
  });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "cooldown" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: stale price feeds → skip 'stale', never builds/sends (no getPrice revert)", async () => {
  let built = false;
  const { deps, calls } = makeDeps({
    arePricesFresh: async () => false,
    buildInstructions: async () => {
      built = true;
      return [SWAP];
    },
  });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "stale" });
  assert.equal(built, false); // gated before buildInstructions (which would hit getPrice)
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: simulation says it would revert → skip 'unsafe', no tx sent", async () => {
  const { deps, calls } = makeDeps({ simulateRebalance: async () => false });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "unsafe" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: within cooldown → skip", async () => {
  const { deps, calls } = makeDeps({
    readVaultMeta: async () => meta({ lastRebalanceTime: 900n, minRebalanceInterval: 200n }),
    now: () => 1000n, // 1000 < 900+200
  });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "cooldown" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: cooldown elapsed + already balanced → skip", async () => {
  const { deps, calls } = makeDeps({
    readVaultMeta: async () => meta({ lastRebalanceTime: 900n, minRebalanceInterval: 100n }),
    now: () => 1000n, // 1000 >= 1000, cooldown done
    buildInstructions: async () => [],
  });
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "skip", reason: "balanced" });
  assert.equal(calls.sendRebalance.length, 0);
});

test("processVault: imbalanced → sends rebalance with the built instructions", async () => {
  const { deps, calls } = makeDeps();
  const out = await new RebalancerService(deps).processVault(V1);
  assert.deepEqual(out, { action: "rebalanced", hash: "0xhash", swaps: 1 });
  assert.equal(calls.sendRebalance.length, 1);
  assert.equal(calls.sendRebalance[0]!.vault, V1);
  assert.deepEqual(calls.sendRebalance[0]!.instr, [SWAP]);
});

test("runOnce: isolates a failing vault and still processes the rest", async () => {
  const seen: string[] = [];
  const { deps, calls } = makeDeps({
    listVaults: async () => [V1, V2],
    readVaultMeta: async (v) => {
      seen.push(v);
      if (v === V1) throw new Error("rpc blip");
      return meta();
    },
  });
  await new RebalancerService(deps).runOnce();
  assert.deepEqual(seen, [V1, V2]); // both attempted
  assert.equal(calls.sendRebalance.length, 1); // only V2 rebalanced
  assert.equal(calls.sendRebalance[0]!.vault, V2);
});

test("listVaults / buildSwapInstructions delegate to deps", async () => {
  const { deps } = makeDeps({
    listVaults: async () => [V1, V2],
    buildInstructions: async () => [SWAP, SWAP],
  });
  const svc = new RebalancerService(deps);
  assert.deepEqual(await svc.listVaults(), [V1, V2]);
  assert.equal((await svc.buildSwapInstructions(V1, 2)).length, 2);
});
