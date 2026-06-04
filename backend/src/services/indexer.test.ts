import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toVaultRecord,
  toRebalanceActivity,
  toActivityLogRecord,
  toRiskUpdate,
  IndexerService,
  type IndexerRepo,
  type VaultRecord,
  type ActivityRecord,
  type RiskUpdate,
} from "./indexer.js";

const VAULT = "0x00000000000000000000000000000000000000aa";
const USER = "0x00000000000000000000000000000000000000bb";
const AGENT = "0x00000000000000000000000000000000000000cc";

test("toVaultRecord maps user/vault/block", () => {
  assert.deepEqual(toVaultRecord(USER, VAULT, 42n), {
    address: VAULT,
    owner: USER,
    deployedBlock: 42n,
  });
});

test("toRebalanceActivity maps to a REBALANCE activity with a Date timestamp", () => {
  const rec = toRebalanceActivity({
    vault: VAULT,
    agent: AGENT,
    timestampSec: 1_700_000_000n,
    swaps: 3,
    txHash: "0xdead",
    blockNumber: 99n,
  });
  assert.equal(rec.action, "REBALANCE");
  assert.equal(rec.vaultAddress, VAULT);
  assert.equal(rec.agentAddress, AGENT);
  assert.deepEqual(rec.metadata, { swaps: 3 });
  assert.equal(rec.txHash, "0xdead");
  assert.equal(rec.blockNumber, 99n);
  assert.deepEqual(rec.timestamp, new Date(1_700_000_000_000));
});

test("toActivityLogRecord maps a generic logged activity", () => {
  const rec = toActivityLogRecord({
    vault: VAULT,
    agent: AGENT,
    action: "PAUSE",
    timestampSec: 1_700_000_000n,
    txHash: null,
    blockNumber: 5n,
  });
  assert.equal(rec.action, "PAUSE");
  assert.equal(rec.vaultAddress, VAULT);
  assert.deepEqual(rec.metadata, {});
  assert.deepEqual(rec.timestamp, new Date(1_700_000_000_000));
});

type PosOp = { vault: string; owner?: string; shares: bigint; assets?: bigint; op: "add" | "sub" };

function fakeRepo() {
  const vaults: VaultRecord[] = [];
  const activities: ActivityRecord[] = [];
  const positions: PosOp[] = [];
  const risks: { vault: string; update: RiskUpdate }[] = [];
  const repo: IndexerRepo = {
    upsertVault: async (r) => void vaults.push(r),
    recordActivity: async (r) => void activities.push(r),
    addToPosition: async (vault, owner, shares, assets) =>
      void positions.push({ vault, owner, shares, assets, op: "add" }),
    subFromPosition: async (vault, shares) => void positions.push({ vault, shares, op: "sub" }),
    setRiskPreference: async (vault, update) => void risks.push({ vault, update }),
  };
  return { repo, vaults, activities, positions, risks };
}

test("onVaultDeployed upserts the mapped vault record", async () => {
  const { repo, vaults } = fakeRepo();
  await new IndexerService(repo).onVaultDeployed(USER, VAULT, 7n);
  assert.equal(vaults.length, 1);
  assert.deepEqual(vaults[0], { address: VAULT, owner: USER, deployedBlock: 7n });
});

test("onRebalanced records the mapped activity", async () => {
  const { repo, activities } = fakeRepo();
  await new IndexerService(repo).onRebalanced({
    vault: VAULT,
    agent: AGENT,
    timestampSec: 1_700_000_000n,
    swaps: 2,
    txHash: null,
    blockNumber: null,
  });
  assert.equal(activities.length, 1);
  assert.equal(activities[0]!.action, "REBALANCE");
  assert.deepEqual(activities[0]!.metadata, { swaps: 2 });
});

test("onActivityLogged records the mapped activity", async () => {
  const { repo, activities } = fakeRepo();
  await new IndexerService(repo).onActivityLogged({
    vault: VAULT,
    agent: AGENT,
    action: "REBALANCE",
    timestampSec: 1_700_000_000n,
    txHash: "0xabc",
    blockNumber: 3n,
  });
  assert.equal(activities.length, 1);
  assert.equal(activities[0]!.txHash, "0xabc");
});

test("handlers broadcast a WS event after persisting", async () => {
  const { repo } = fakeRepo();
  const events: { type: string }[] = [];
  const svc = new IndexerService(repo, (e) => events.push(e));

  await svc.onVaultDeployed(USER, VAULT, 1n);
  await svc.onRebalanced({ vault: VAULT, agent: AGENT, timestampSec: 1n, swaps: 1, txHash: null, blockNumber: null });
  await svc.onActivityLogged({ vault: VAULT, agent: AGENT, action: "PAUSE", timestampSec: 1n, txHash: null, blockNumber: null });

  assert.deepEqual(events.map((e) => e.type), ["vault_deployed", "rebalanced", "activity"]);
});

test("toRiskUpdate: keeps bps only for CUSTOM (level 3)", () => {
  assert.deepEqual(toRiskUpdate(2, 0, 0, 0), {
    riskPreference: 2, lowBps: null, medBps: null, highBps: null,
  });
  assert.deepEqual(toRiskUpdate(3, 5000, 3000, 2000), {
    riskPreference: 3, lowBps: 5000, medBps: 3000, highBps: 2000,
  });
});

test("onDeposit adds shares + cost basis to the position", async () => {
  const { repo, positions } = fakeRepo();
  await new IndexerService(repo).onDeposit(VAULT, USER, 1_000_000n, 999n);
  assert.deepEqual(positions, [
    { vault: VAULT, owner: USER, shares: 999n, assets: 1_000_000n, op: "add" },
  ]);
});

test("onWithdraw reduces shares", async () => {
  const { repo, positions } = fakeRepo();
  await new IndexerService(repo).onWithdraw(VAULT, USER, 500_000n, 499n);
  assert.deepEqual(positions, [{ vault: VAULT, shares: 499n, op: "sub" }]);
});

test("onRiskPreferenceUpdated persists the mapped risk update", async () => {
  const { repo, risks } = fakeRepo();
  await new IndexerService(repo).onRiskPreferenceUpdated(VAULT, 3, 6000, 2000, 2000);
  assert.equal(risks.length, 1);
  assert.deepEqual(risks[0]!.update, {
    riskPreference: 3, lowBps: 6000, medBps: 2000, highBps: 2000,
  });
});

test("deposit/withdraw/risk handlers broadcast WS events", async () => {
  const { repo } = fakeRepo();
  const events: { type: string }[] = [];
  const svc = new IndexerService(repo, (e) => events.push(e));
  await svc.onDeposit(VAULT, USER, 1n, 1n);
  await svc.onWithdraw(VAULT, USER, 1n, 1n);
  await svc.onRiskPreferenceUpdated(VAULT, 1, 0, 0, 0);
  assert.deepEqual(events.map((e) => e.type), ["deposit", "withdraw", "risk_updated"]);
});
