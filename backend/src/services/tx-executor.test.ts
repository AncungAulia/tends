import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, parseUnits } from "viem";
import { txExecutorService } from "./tx-executor.js";

const WITHDRAW_ABI = [
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const VAULT = "0x00000000000000000000000000000000000000aa" as const;
const USER = "0x00000000000000000000000000000000000000bb" as const;

test("prepareWithdrawTx targets the vault with zero value", () => {
  const tx = txExecutorService.prepareWithdrawTx(VAULT, USER, 100);
  assert.equal(tx.to, VAULT);
  assert.equal(tx.value, "0");
  assert.match(tx.data, /^0x[0-9a-f]+$/i);
});

test("prepareWithdrawTx encodes withdraw(assets@6dec, receiver, owner)", () => {
  const tx = txExecutorService.prepareWithdrawTx(VAULT, USER, 250.5);
  const decoded = decodeFunctionData({ abi: WITHDRAW_ABI, data: tx.data });
  assert.equal(decoded.functionName, "withdraw");
  assert.deepEqual(decoded.args, [parseUnits("250.5", 6), USER, USER]);
  // receiver and owner are both the user
  assert.equal(decoded.args[1], decoded.args[2]);
});

test("prepareWithdrawTx uses USDC 6-decimal scaling", () => {
  const tx = txExecutorService.prepareWithdrawTx(VAULT, USER, 1);
  const decoded = decodeFunctionData({ abi: WITHDRAW_ABI, data: tx.data });
  assert.equal(decoded.args[0], 1_000_000n); // 1 USDC = 1e6
});
