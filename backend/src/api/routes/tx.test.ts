import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { decodeFunctionData } from "viem";
import { makeTxRouter, type TxDeps } from "./tx.js";
import { makeAuthMiddleware } from "../auth.js";
import { USER_VAULT_TX_ABI } from "../../chain/abis.js";

type Step = { to: string; data: `0x${string}`; value: string };
const decode = (s: Step) => decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: s.data });

const VAULT = "0x00000000000000000000000000000000000000aa";
const ACCOUNT = "0x00000000000000000000000000000000000000bb";

// Stub: agentLiquidate + USDC balance read — 200 USDC available, no real RPC
const MOCK_USDC_BALANCE = 200_000_000n; // 200 USDC (6 dec)
const stubDeps: TxDeps = {
  agentLiquidateAndBalance: async () => MOCK_USDC_BALANCE,
};

function app(deps?: TxDeps) {
  const auth = makeAuthMiddleware(async (t) => {
    if (t === "good") return { privyId: "did:privy:1" };
    throw new Error("bad");
  });
  return new Hono().route("/api/users/me", makeTxRouter(auth, deps));
}

const post = (path: string, body?: unknown, token = "good", deps?: TxDeps) =>
  app(deps).request(`/api/users/me${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test("tx routes require auth", async () => {
  const res = await app().request("/api/users/me/deploy-vault", { method: "POST" });
  assert.equal(res.status, 401);
});

test("POST /deploy-vault returns a single tx", async () => {
  const res = await post("/deploy-vault");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { tx: { to: string; data: string } };
  assert.match(body.tx.data, /^0x[0-9a-f]+$/i);
});

test("POST /prepare-deposit returns [approve, deposit]", async () => {
  const res = await post("/prepare-deposit", { vault: VAULT, account: ACCOUNT, amount: 100 });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { steps: unknown[] };
  assert.equal(body.steps.length, 2);
});

test("POST /prepare-deposit rejects a bad address / amount", async () => {
  assert.equal((await post("/prepare-deposit", { vault: "0xnope", account: ACCOUNT, amount: 100 })).status, 400);
  assert.equal((await post("/prepare-deposit", { vault: VAULT, account: ACCOUNT, amount: -1 })).status, 400);
});

test("POST /prepare-deposit rejects out-of-range amount (no 500 from parseUnits)", async () => {
  // < 1 USDC unit (would become "1e-7" → parseUnits throw)
  assert.equal((await post("/prepare-deposit", { vault: VAULT, account: ACCOUNT, amount: 0.0000001 })).status, 400);
  // absurdly large (would be exponential)
  assert.equal((await post("/prepare-deposit", { vault: VAULT, account: ACCOUNT, amount: 2e12 })).status, 400);
});

test("POST /prepare-deposit-permit: encodes depositWithPermit from a signature", async () => {
  const sig = "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b"; // r + s + v(27)
  const ok = await post("/prepare-deposit-permit", {
    vault: VAULT, account: ACCOUNT, amount: 50, deadline: 1_800_000_000, signature: sig,
  });
  assert.equal(ok.status, 200);
  assert.equal(decode((await ok.json() as { tx: Step }).tx).functionName, "depositWithPermit");

  // malformed signature → 400
  assert.equal(
    (await post("/prepare-deposit-permit", {
      vault: VAULT, account: ACCOUNT, amount: 50, deadline: 1_800_000_000, signature: "0xdead",
    })).status,
    400,
  );
});

test("POST /prepare-withdraw: agentLiquidate → read balance → encode withdraw tx", async () => {
  // 200 USDC available; amount 5 < 200 → no clamp
  const res = await post("/prepare-withdraw", { vault: VAULT, account: ACCOUNT, amount: 5 }, "good", stubDeps);
  assert.equal(res.status, 200);
  const body = await res.json() as { tx: Step };
  assert.ok(body.tx, "response must have a tx field");
  assert.equal(decode(body.tx).functionName, "withdraw");
});

test("POST /prepare-withdraw: amount clamped when larger than USDC balance", async () => {
  // 200 USDC available; requesting 999 → clamped to ~199.8
  const res = await post("/prepare-withdraw", { vault: VAULT, account: ACCOUNT, amount: 999 }, "good", stubDeps);
  assert.equal(res.status, 200);
  const body = await res.json() as { tx: Step };
  assert.equal(decode(body.tx).functionName, "withdraw");
  // encoded assets (6 dec) must be ≤ 200_000_000 (200 USDC)
  const [assets] = decode(body.tx).args as [bigint, ...unknown[]];
  assert.ok(assets <= 200_000_000n, `clamped assets ${assets} should be ≤ 200 USDC`);
});

test("POST /prepare-switch: preset → single setRiskLevel(level)", async () => {
  const res = await post("/prepare-switch", { vault: VAULT, strategyId: "HIGH" });
  assert.equal(res.status, 200);
  const { steps } = (await res.json()) as { steps: Step[] };
  assert.equal(steps.length, 1);
  const d = decode(steps[0]!);
  assert.equal(d.functionName, "setRiskLevel");
  assert.deepEqual(d.args, [2]); // HIGH
});

test("POST /prepare-switch CUSTOM → single setCustomAllocation (NOT setRiskLevel, which reverts)", async () => {
  assert.equal((await post("/prepare-switch", { vault: VAULT, strategyId: "CUSTOM" })).status, 400);
  assert.equal(
    (await post("/prepare-switch", {
      vault: VAULT,
      strategyId: "CUSTOM",
      customAllocation: { lowBps: 5000, medBps: 4000, highBps: 0 }, // bad sum
    })).status,
    400,
  );
  const ok = await post("/prepare-switch", {
    vault: VAULT,
    strategyId: "CUSTOM",
    customAllocation: { lowBps: 5000, medBps: 3000, highBps: 2000 },
  });
  assert.equal(ok.status, 200);
  const { steps } = (await ok.json()) as { steps: Step[] };
  assert.equal(steps.length, 1);
  const d = decode(steps[0]!);
  assert.equal(d.functionName, "setCustomAllocation"); // regression guard
  assert.deepEqual(d.args, [5000, 3000, 2000]);
});
