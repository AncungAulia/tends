import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, getAddress } from "viem";
import { txExecutorService as tx } from "./tx-executor.js";
import {
  ERC20_ABI,
  USER_VAULT_TX_ABI,
  VAULT_FACTORY_TX_ABI,
} from "../chain/abis.js";
import { TOKENS } from "../chain/tokens.js";
import { addresses } from "../chain/addresses.js";

// checksummed to match viem's decodeFunctionData output
const VAULT = getAddress("0x00000000000000000000000000000000000000aa");
const USER = getAddress("0x00000000000000000000000000000000000000bb");

test("prepareApproveUsdc → USDC.approve(vault, amount@6dec)", () => {
  const t = tx.prepareApproveUsdc(VAULT, 100);
  assert.equal(t.to, TOKENS.USDC.address);
  assert.equal(t.value, "0");
  const d = decodeFunctionData({ abi: ERC20_ABI, data: t.data });
  assert.equal(d.functionName, "approve");
  assert.deepEqual(d.args, [VAULT, 100_000_000n]);
});

test("prepareDeposit → vault.deposit(assets@6dec, receiver)", () => {
  const t = tx.prepareDeposit(VAULT, USER, 250);
  assert.equal(t.to, VAULT);
  const d = decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: t.data });
  assert.equal(d.functionName, "deposit");
  assert.deepEqual(d.args, [250_000_000n, USER]);
});

test("prepareWithdraw → vault.withdraw(assets, receiver=owner, owner)", () => {
  const t = tx.prepareWithdraw(VAULT, USER, 10);
  const d = decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: t.data });
  assert.equal(d.functionName, "withdraw");
  assert.deepEqual(d.args, [10_000_000n, USER, USER]);
});

test("prepareDeployVault → factory.deployVault()", () => {
  const t = tx.prepareDeployVault();
  assert.equal(t.to, addresses.vaultFactory);
  const d = decodeFunctionData({ abi: VAULT_FACTORY_TX_ABI, data: t.data });
  assert.equal(d.functionName, "deployVault");
});

test("prepareSetRisk → vault.setRiskLevel(level)", () => {
  const t = tx.prepareSetRisk(VAULT, 2);
  const d = decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: t.data });
  assert.equal(d.functionName, "setRiskLevel");
  assert.deepEqual(d.args, [2]);
});

test("prepareSetCustomAllocation → vault.setCustomAllocation(low, med, high)", () => {
  const t = tx.prepareSetCustomAllocation(VAULT, 5000, 3000, 2000);
  const d = decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: t.data });
  assert.equal(d.functionName, "setCustomAllocation");
  assert.deepEqual(d.args, [5000, 3000, 2000]);
});
