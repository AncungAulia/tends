import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPnlSeries, PnlService, type PnlRepo } from "../../src/services/pnl.js";
import { env } from "../../src/config/env.js";
import { addresses } from "../../src/chain/addresses.js";

const USDC = 10 ** 6;

test("buildPnlSeries: USDC base units → human USD, pnl vs cost basis", () => {
  const t0 = new Date("2026-06-01T00:00:00Z");
  const t1 = new Date("2026-06-02T00:00:00Z");
  const { initialDepositUsd, points } = buildPnlSeries(
    [
      { totalAssets: String(1000 * USDC), snapshotAt: t0 },
      { totalAssets: String(1050 * USDC), snapshotAt: t1 },
    ],
    String(1000 * USDC), // deposited $1000
  );
  assert.equal(initialDepositUsd, 1000);
  assert.equal(points.length, 2);
  assert.deepEqual(points[0], {
    t: Math.floor(t0.getTime() / 1000),
    valueUsd: 1000,
    pnlUsd: 0,
    pnlPct: 0,
  });
  // +$50 on $1000 = +5%
  assert.equal(points[1]!.valueUsd, 1050);
  assert.equal(points[1]!.pnlUsd, 50);
  assert.equal(points[1]!.pnlPct, 5);
});

test("buildPnlSeries: zero cost basis → pnlPct 0 (no divide-by-zero)", () => {
  const { points } = buildPnlSeries(
    [{ totalAssets: String(10 * USDC), snapshotAt: new Date() }],
    "0",
  );
  assert.equal(points[0]!.pnlPct, 0);
  assert.equal(points[0]!.valueUsd, 10);
});

function fakeRepo(vaults: string[]) {
  const saved: { vault: string; totalAssets: string }[] = [];
  const repo: PnlRepo = {
    listVaultAddresses: async () => vaults,
    saveSnapshot: async (vaultAddress, totalAssets) => {
      saved.push({ vault: vaultAddress, totalAssets });
    },
  };
  return { repo, saved };
}

test("PnlService.run: snapshots totalAssets for each vault", async () => {
  const { repo, saved } = fakeRepo(["0xaaa", "0xbbb"]);
  const svc = new PnlService(repo, false, async (v) => (v === "0xaaa" ? 100n : 200n));
  await svc.run();

  if (env.USE_MOCK_CONTRACTS || !addresses.vaultFactory) {
    assert.equal(saved.length, 0); // mock mode short-circuits
    return;
  }
  assert.deepEqual(saved, [
    { vault: "0xaaa", totalAssets: "100" },
    { vault: "0xbbb", totalAssets: "200" },
  ]);
});

test("PnlService.run: a failing vault read is isolated, others still recorded", async () => {
  if (env.USE_MOCK_CONTRACTS || !addresses.vaultFactory) return;
  const { repo, saved } = fakeRepo(["0xaaa", "0xbad", "0xccc"]);
  const svc = new PnlService(repo, false, async (v) => {
    if (v === "0xbad") throw new Error("revert");
    return 42n;
  });
  await svc.run();
  assert.deepEqual(
    saved.map((s) => s.vault),
    ["0xaaa", "0xccc"],
  );
});

test("PnlService.run: mock mode writes nothing", async () => {
  const { repo, saved } = fakeRepo(["0xaaa"]);
  const svc = new PnlService(repo, true, async () => 1n);
  await svc.run();
  assert.equal(saved.length, 0);
});
