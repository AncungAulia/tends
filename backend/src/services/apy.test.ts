import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualizedApy,
  apyFromSnapshots,
  ApyService,
  type ApyRepo,
  type Snap,
} from "./apy.js";

const E18 = 10n ** 18n;
const MS_DAY = 86_400_000;

test("annualizedApy: 5% over a full year", () => {
  const apy = annualizedApy(E18, (E18 * 105n) / 100n, 365);
  assert.ok(Math.abs(apy! - 5) < 0.01, `got ${apy}`);
});

test("annualizedApy: short window annualizes up", () => {
  const apy = annualizedApy(E18, (E18 * 101n) / 100n, 30)!; // 1% in 30d
  assert.ok(apy > 12 && apy < 14, `got ${apy}`); // ~12.9%
});

test("annualizedApy: invalid inputs → null", () => {
  assert.equal(annualizedApy(0n, E18, 30), null);
  assert.equal(annualizedApy(E18, E18, 0), null);
  assert.equal(annualizedApy(E18, 0n, 30), null);
});

test("apyFromSnapshots: needs ≥2 points spanning ≥1 day (else noise)", () => {
  const now = Date.now();
  assert.equal(apyFromSnapshots([]), null);
  assert.equal(apyFromSnapshots([{ priceWad: E18.toString(), snapshotAt: new Date(now) }]), null);
  // 14h span (< 1 day) → null
  assert.equal(
    apyFromSnapshots([
      { priceWad: E18.toString(), snapshotAt: new Date(now) },
      { priceWad: ((E18 * 101n) / 100n).toString(), snapshotAt: new Date(now + 14 * 3_600_000) },
    ]),
    null,
  );
});

test("apyFromSnapshots: computes realized APY from growth", () => {
  const t0 = Date.now() - 10 * MS_DAY;
  const snaps: Snap[] = [
    { priceWad: E18.toString(), snapshotAt: new Date(t0) },
    { priceWad: ((E18 * 1001n) / 1000n).toString(), snapshotAt: new Date(t0 + 10 * MS_DAY) },
  ];
  const apy = apyFromSnapshots(snaps)!;
  assert.equal(apy, annualizedApy(E18, (E18 * 1001n) / 1000n, 10)); // 0.1% over 10d, annualized
  assert.ok(apy > 0);
});

function fakeRepo(byAsset: Record<string, Snap[] | "throw">): ApyRepo {
  return {
    saveSnapshot: async () => {},
    recordApy: async () => {},
    windowSnapshots: async (asset) => {
      const v = byAsset[asset] ?? [];
      if (v === "throw") throw new Error("db down");
      return v;
    },
  };
}

test("getApyMap: derived where available, estimate otherwise", async () => {
  const t0 = Date.now() - 10 * MS_DAY;
  const sUSDeSnaps: Snap[] = [
    { priceWad: E18.toString(), snapshotAt: new Date(t0) },
    { priceWad: ((E18 * 1001n) / 1000n).toString(), snapshotAt: new Date(t0 + 10 * MS_DAY) },
  ];
  const map = await new ApyService(fakeRepo({ sUSDe: sUSDeSnaps, USDY: [] })).getApyMap();

  const expected = Math.round(apyFromSnapshots(sUSDeSnaps)! * 100) / 100;
  assert.equal(map.sUSDe, expected); // derived
  assert.equal(map.USDY, 5); // no snapshots → DEFAULT estimate
  assert.equal(map.mETH, 3.5); // never derivable → estimate
});

test("getApyMap: resilient to a failing read (falls back to estimate)", async () => {
  const map = await new ApyService(fakeRepo({ sUSDe: "throw", USDY: "throw" })).getApyMap();
  assert.equal(map.sUSDe, 12); // DEFAULT estimate, no throw
  assert.equal(map.USDY, 5);
});

test("getApyMap: absurd (out-of-band) derived APY is discarded for the estimate", async () => {
  const t0 = Date.now() - 2 * MS_DAY;
  // 1.0 → 2.0 over 2 days → annualizes to a gigantic % → must be rejected, not shown
  const wild: Snap[] = [
    { priceWad: E18.toString(), snapshotAt: new Date(t0) },
    { priceWad: (E18 * 2n).toString(), snapshotAt: new Date(t0 + 2 * MS_DAY) },
  ];
  const map = await new ApyService(fakeRepo({ sUSDe: wild, USDY: [] })).getApyMap();
  assert.equal(map.sUSDe, 12); // estimate, not the absurd derived value
});
