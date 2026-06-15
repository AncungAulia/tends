import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualizedApy,
  apyFromSnapshots,
  ApyService,
  LIVE_APY_POOLS,
  type ApyRepo,
  type Snap,
} from "../../src/services/apy.js";

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

interface FakeOpts {
  snaps?: Record<string, Snap[] | "throw">; // windowSnapshots (run() derivation)
  cached?: Record<string, number> | "throw"; // latestApy (getApyMap cache)
}
function fakeRepo(opts: FakeOpts = {}) {
  const recorded: Record<string, number> = {};
  const repo: ApyRepo = {
    saveSnapshot: async () => {},
    recordApy: async (asset, apy) => void (recorded[asset] = apy),
    windowSnapshots: async (asset) => {
      const v = opts.snaps?.[asset] ?? [];
      if (v === "throw") throw new Error("db down");
      return v;
    },
    latestApy: async () => {
      if (opts.cached === "throw") throw new Error("db down");
      return opts.cached ?? {};
    },
  };
  return { repo, recorded };
}

// ── getApyMap: reads the cached (live/derived) APY, layered over the estimate ──
test("getApyMap: layers cached APY over the estimate", async () => {
  const { repo } = fakeRepo({ cached: { sUSDe: 13.5, USDY: 4.2 } });
  const map = await new ApyService(repo, false).getApyMap();
  assert.equal(map.sUSDe, 13.5); // cached live value
  assert.equal(map.USDY, 4.2);
  assert.equal(map.mETH, 4); // not cached → DEFAULT estimate
});

test("getApyMap: USE_MOCK_CONTRACTS returns estimates only (ignores cache)", async () => {
  const { repo } = fakeRepo({ cached: { sUSDe: 3.5 } });
  const map = await new ApyService(repo, true).getApyMap();
  assert.equal(map.sUSDe, 14); // estimate — mock prices ≠ real yield
  assert.equal(map.USDY, 5);
});

test("getApyMap: resilient to a failing read (falls back to estimate)", async () => {
  const { repo } = fakeRepo({ cached: "throw" });
  const map = await new ApyService(repo, false).getApyMap();
  assert.equal(map.sUSDe, 14); // DEFAULT estimate, no throw
  assert.equal(map.USDY, 5);
});

test("getApyMap: out-of-band cached APY is discarded for the estimate", async () => {
  const { repo } = fakeRepo({ cached: { sUSDe: 999 } }); // absurd → rejected
  const map = await new ApyService(repo, false).getApyMap();
  assert.equal(map.sUSDe, 14);
});

// ── fetchLiveApy: real protocol rates with per-token fallback ──────────────────
test("fetchLiveApy: keeps sane live values, drops null + out-of-band", async () => {
  const { repo } = fakeRepo();
  const svc = new ApyService(repo, false, async (pool) =>
    pool === LIVE_APY_POOLS.sUSDe ? 3.79 : null,
  ); // USDY source returns null → omitted
  const live = await svc.fetchLiveApy();
  assert.equal(live.sUSDe, 3.79);
  assert.equal("USDY" in live, false); // null → caller falls back to estimate
});

test("fetchLiveApy: a throwing source is swallowed (omitted)", async () => {
  const { repo } = fakeRepo();
  const svc = new ApyService(repo, false, async () => {
    throw new Error("network");
  });
  assert.deepEqual(await svc.fetchLiveApy(), {});
});

// ── run: caches live > derived > estimate to apyHistory ───────────────────────
test("run: caches live protocol APY + estimates to history (mock mode)", async () => {
  const { repo, recorded } = fakeRepo();
  // useMock=true → snapshotPrices/derivation skipped; live fetch still runs
  const svc = new ApyService(repo, true, async (pool) =>
    pool === LIVE_APY_POOLS.sUSDe ? 3.5 : pool === LIVE_APY_POOLS.USDY ? 4.1 : null,
  );
  await svc.run();
  assert.equal(recorded.sUSDe, 3.5); // live (overrides the 14 estimate)
  assert.equal(recorded.USDY, 4.1); // live
  assert.equal(recorded.mETH, 4); // estimate (no live source)
});

test("run: falls back to snapshot derivation for tokens without a live source", async () => {
  const t0 = Date.now() - 10 * MS_DAY;
  const usdySnaps: Snap[] = [
    { priceWad: E18.toString(), snapshotAt: new Date(t0) },
    // +0.1% over 10d → ~3.8% annualized (in the sane band, so it's recorded)
    { priceWad: ((E18 * 1001n) / 1000n).toString(), snapshotAt: new Date(t0 + 10 * MS_DAY) },
  ];
  const { repo, recorded } = fakeRepo({ snaps: { USDY: usdySnaps, sUSDe: [] } });
  // live covers sUSDe only; USDY has no live source → derived from snapshots (non-mock).
  // 4th arg = feed-price reader stub so snapshotPrices() never touches the chain.
  const svc = new ApyService(
    repo,
    false,
    async (pool) => (pool === LIVE_APY_POOLS.sUSDe ? 12 : null),
    async () => E18,
  );
  await svc.run();
  assert.equal(recorded.sUSDe, 12); // live
  const derived = Math.round(apyFromSnapshots(usdySnaps)! * 100) / 100;
  assert.equal(recorded.USDY, derived); // snapshot-derived
});
