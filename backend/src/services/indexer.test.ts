import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toVaultRecord,
  toRebalanceActivity,
  toActivityLogRecord,
  toApyRecords,
  IndexerService,
  type IndexerRepo,
  type VaultRecord,
  type ActivityRecord,
  type ApyRecord,
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

test("toApyRecords maps a token→APY map (missing → 0)", () => {
  assert.deepEqual(toApyRecords({ mUSD: 5, USDY: undefined }), [
    { asset: "mUSD", apyPct: 5 },
    { asset: "USDY", apyPct: 0 },
  ]);
});

function fakeRepo() {
  const vaults: VaultRecord[] = [];
  const activities: ActivityRecord[] = [];
  const apys: ApyRecord[] = [];
  const repo: IndexerRepo = {
    upsertVault: async (r) => void vaults.push(r),
    recordActivity: async (r) => void activities.push(r),
    recordApy: async (r) => void apys.push(r),
  };
  return { repo, vaults, activities, apys };
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

test("scrapeAPYs writes one row per asset", async () => {
  const { repo, apys } = fakeRepo();
  await new IndexerService(repo).scrapeAPYs({ mUSD: 5, sUSDe: 12 });
  assert.deepEqual(apys, [
    { asset: "mUSD", apyPct: 5 },
    { asset: "sUSDe", apyPct: 12 },
  ]);
});
