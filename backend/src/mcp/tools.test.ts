import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTools, type ToolDeps } from "./tools.js";

const VAULT = "0x00000000000000000000000000000000000000aa";
const ACCOUNT = "0x00000000000000000000000000000000000000bb";

function fakeDeps() {
  const calls: Record<string, unknown[]> = { position: [], activity: [], apyHistory: [] };
  const deps: ToolDeps = {
    position: async (w) => { calls.position!.push(w); return { vault: { address: VAULT } }; },
    activity: async (w) => { calls.activity!.push(w); return { activities: [] }; },
    apyHistory: async (a, d) => { calls.apyHistory!.push([a, d]); return [{ asset: a }]; },
  };
  return { deps, calls };
}

const tools = (deps: ToolDeps) => {
  const map = new Map(buildTools(deps).map((t) => [t.name, t]));
  return async (name: string, args: unknown) => {
    const res = await map.get(name)!.handler(args);
    return JSON.parse(res.content[0]!.text) as Record<string, unknown>;
  };
};

test("exposes the expected tool set", () => {
  const names = buildTools(fakeDeps().deps).map((t) => t.name).sort();
  assert.deepEqual(names, [
    "computeProjection", "getAgentActivity", "getApyHistory", "listStrategies",
    "prepareDepositTx", "prepareSwitchTx", "prepareWithdrawTx", "readUserPosition",
  ]);
});

test("readUserPosition / getAgentActivity call deps with the wallet", async () => {
  const { deps, calls } = fakeDeps();
  const call = tools(deps);
  await call("readUserPosition", { walletAddress: ACCOUNT });
  await call("getAgentActivity", { walletAddress: ACCOUNT });
  assert.deepEqual(calls.position, [ACCOUNT]);
  assert.deepEqual(calls.activity, [ACCOUNT]);
});

test("getApyHistory defaults days to 30", async () => {
  const { deps, calls } = fakeDeps();
  await tools(deps)("getApyHistory", { asset: "mETH" });
  assert.deepEqual(calls.apyHistory, [["mETH", 30]]);
});

test("listStrategies returns the four strategies", async () => {
  const res = await buildTools(fakeDeps().deps).find((t) => t.name === "listStrategies")!.handler({});
  const arr = JSON.parse(res.content[0]!.text) as unknown[];
  assert.equal(arr.length, 4);
});

test("computeProjection returns base/best/worst", async () => {
  const out = await tools(fakeDeps().deps)("computeProjection", {
    strategyId: "LOW", capital: 1000, durationDays: 365,
  });
  assert.ok(typeof out.base === "number" && typeof out.best === "number");
  assert.ok((out.best as number) >= (out.base as number));
});

test("prepareDepositTx returns approve + deposit steps", async () => {
  const out = await tools(fakeDeps().deps)("prepareDepositTx", { vault: VAULT, account: ACCOUNT, amount: 100 });
  assert.equal((out.steps as unknown[]).length, 2);
});

test("prepareWithdrawTx returns a tx", async () => {
  const out = await tools(fakeDeps().deps)("prepareWithdrawTx", { vault: VAULT, account: ACCOUNT, amount: 5 });
  assert.ok(out.tx);
});

test("prepareSwitchTx: preset one step, CUSTOM validated", async () => {
  const call = tools(fakeDeps().deps);
  assert.equal(((await call("prepareSwitchTx", { vault: VAULT, strategyId: "HIGH" })).steps as unknown[]).length, 1);

  const t = buildTools(fakeDeps().deps).find((x) => x.name === "prepareSwitchTx")!;
  await assert.rejects(() => t.handler({ vault: VAULT, strategyId: "CUSTOM" }));
  await assert.rejects(() =>
    t.handler({ vault: VAULT, strategyId: "CUSTOM", customAllocation: { lowBps: 1, medBps: 1, highBps: 1 } }),
  );
  const okCustom = await call("prepareSwitchTx", {
    vault: VAULT, strategyId: "CUSTOM", customAllocation: { lowBps: 5000, medBps: 3000, highBps: 2000 },
  });
  assert.equal((okCustom.steps as unknown[]).length, 2);
});
