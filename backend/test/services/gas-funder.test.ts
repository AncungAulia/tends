import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther } from "viem";
import {
  needsTopUp,
  GasFunderService,
  GAS_THRESHOLD,
  GAS_TOPUP,
  type GasFunderDeps,
} from "../../src/services/gas-funder.js";

const WALLET = "0x00000000000000000000000000000000000000aa" as const;

test("needsTopUp: below threshold only", () => {
  assert.equal(needsTopUp(GAS_THRESHOLD - 1n), true);
  assert.equal(needsTopUp(GAS_THRESHOLD), false);
  assert.equal(needsTopUp(GAS_THRESHOLD + 1n), false);
});

function fakeDeps(balance: bigint) {
  const calls = { sent: [] as { to: string; amount: bigint }[], recorded: [] as string[] };
  const deps: GasFunderDeps = {
    getBalance: async () => balance,
    sendTopUp: async (to, amount) => {
      calls.sent.push({ to, amount });
      return "0xhash";
    },
    recordTopUp: async (_to, _amount, hash) => void calls.recorded.push(hash),
  };
  return { deps, calls };
}

test("ensureGasFunded: skips when balance is sufficient", async () => {
  const { deps, calls } = fakeDeps(parseEther("1"));
  const hash = await new GasFunderService(deps).ensureGasFunded(WALLET);
  assert.equal(hash, null);
  assert.equal(calls.sent.length, 0);
  assert.equal(calls.recorded.length, 0);
});

test("ensureGasFunded: tops up + records when low", async () => {
  const { deps, calls } = fakeDeps(parseEther("0.01"));
  const hash = await new GasFunderService(deps).ensureGasFunded(WALLET);
  assert.equal(hash, "0xhash");
  assert.deepEqual(calls.sent, [{ to: WALLET, amount: GAS_TOPUP }]);
  assert.deepEqual(calls.recorded, ["0xhash"]);
});
