import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFunctionData, getAddress } from "viem";
import { txExecutorService as tx, permitTypedData } from "../../src/services/tx-executor.js";
import {
  ERC20_ABI,
  USER_VAULT_TX_ABI,
  VAULT_FACTORY_TX_ABI,
} from "../../src/chain/abis.js";
import { TOKENS } from "../../src/chain/tokens.js";
import { addresses } from "../../src/chain/addresses.js";

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

test("amount scaling: rounds >6dp, handles the smallest unit, no exponential throw", () => {
  const args = (amount: number) =>
    decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: tx.prepareDeposit(VAULT, USER, amount).data }).args;
  assert.equal(args(100.1234567)[0], 100_123_457n); // 7th dp rounded into 6
  assert.equal(args(0.000001)[0], 1n); // smallest USDC unit
  assert.doesNotThrow(() => tx.prepareDeposit(VAULT, USER, 1e12)); // would be "1e+12" via toString()
});

test("prepareDepositWithPermit → vault.depositWithPermit(assets, receiver, deadline, v, r, s)", () => {
  const r = ("0x" + "ab".repeat(32)) as `0x${string}`;
  const s = ("0x" + "cd".repeat(32)) as `0x${string}`;
  const t = tx.prepareDepositWithPermit(VAULT, USER, 100, 1_800_000_000n, 27, r, s);
  const d = decodeFunctionData({ abi: USER_VAULT_TX_ABI, data: t.data });
  assert.equal(d.functionName, "depositWithPermit");
  assert.deepEqual(d.args, [100_000_000n, USER, 1_800_000_000n, 27, r, s]);
});

test("permitTypedData: USDC EIP-2612 domain + Permit message", () => {
  const td = permitTypedData({
    chainId: 5003, owner: USER, spender: VAULT,
    value: 100_000_000n, nonce: 3n, deadline: 1_800_000_000n,
  });
  assert.equal(td.domain.name, "USD Coin");
  assert.equal(td.domain.version, "1");
  assert.equal(td.domain.chainId, 5003);
  assert.equal(td.primaryType, "Permit");
  assert.equal(td.types.Permit.length, 5);
  assert.deepEqual(td.message, {
    owner: USER, spender: VAULT, value: 100_000_000n, nonce: 3n, deadline: 1_800_000_000n,
  });
});
