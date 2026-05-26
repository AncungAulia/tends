import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFreshness,
  assessBounds,
  criticalBreaches,
  PriceMonitorService,
  type PriceMonitorDeps,
  type PriceBoundStatus,
  type RiskGuardOpts,
} from "./price-monitor.js";
import { env } from "../config/env.js";
import { addresses } from "../chain/addresses.js";
import { TOKENS } from "../chain/tokens.js";

const E18 = 10n ** 18n;

test("classifyFreshness: fresh feed", () => {
  assert.deepEqual(classifyFreshness(1000n, 100n, 950n), { ageSeconds: 50, stale: false });
});

test("classifyFreshness: exactly at maxStaleness is still fresh (strict >)", () => {
  assert.deepEqual(classifyFreshness(1000n, 100n, 900n), { ageSeconds: 100, stale: false });
});

test("classifyFreshness: beyond maxStaleness is stale", () => {
  assert.deepEqual(classifyFreshness(1000n, 100n, 899n), { ageSeconds: 101, stale: true });
});

test("classifyFreshness: unset (updatedAt 0) is stale with max age", () => {
  assert.deepEqual(classifyFreshness(1000n, 100n, 0n), {
    ageSeconds: Number.MAX_SAFE_INTEGER,
    stale: true,
  });
});

test("assessBounds: in-band / below / above / zero", () => {
  const lo = (E18 * 97n) / 100n;
  const hi = (E18 * 13n) / 10n;
  assert.deepEqual(assessBounds(E18, lo, hi), { ok: true, reason: null });
  assert.deepEqual(assessBounds(E18 / 2n, lo, hi), { ok: false, reason: "below" });
  assert.deepEqual(assessBounds(E18 * 2n, lo, hi), { ok: false, reason: "above" });
  assert.deepEqual(assessBounds(0n, lo, hi), { ok: false, reason: "zero" });
});

test("checkPrices: flags a token below its band (depeg), others ok", async () => {
  const deps: PriceMonitorDeps = {
    readNow: async () => 1000n,
    readMaxStaleness: async () => 7200n,
    readPriceUnsafe: async (t) =>
      t === TOKENS.USDY.address ? ([E18 / 2n, 1000n] as const) : ([E18, 1000n] as const),
  };
  const out = await new PriceMonitorService(deps).checkPrices();
  if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) {
    assert.deepEqual(out, []);
    return;
  }
  assert.equal(out.length, 4); // USDC, mUSD, USDY, sUSDe
  const breaches = out.filter((s) => !s.ok);
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0]!.symbol, "USDY");
  assert.equal(breaches[0]!.reason, "below");
});

test("criticalBreaches: below/zero are critical; above/ok are not", () => {
  const mk = (symbol: string, reason: PriceBoundStatus["reason"], ok: boolean): PriceBoundStatus =>
    ({ symbol: symbol as PriceBoundStatus["symbol"], price: 1n, ok, reason });
  const out = criticalBreaches([
    mk("USDC", "below", false),
    mk("mUSD", "zero", false),
    mk("USDY", "above", false),
    mk("sUSDe", null, true),
  ]);
  assert.deepEqual(out.map((s) => s.symbol), ["USDC", "mUSD"]);
});

function guardDeps(over: Partial<RiskGuardOpts> = {}) {
  const paused: string[] = [];
  const opts: RiskGuardOpts = {
    enabled: true,
    listVaults: async () => ["0x01" as `0x${string}`, "0x02" as `0x${string}`],
    pauseVault: async (v) => {
      paused.push(v);
      return "0xhash";
    },
    ...over,
  };
  return { opts, paused };
}

function depsWith(usdyPrice: bigint): PriceMonitorDeps {
  return {
    readNow: async () => 1000n,
    readMaxStaleness: async () => 7200n,
    readPriceUnsafe: async (t) =>
      t === TOKENS.USDY.address ? ([usdyPrice, 1000n] as const) : ([E18, 1000n] as const),
  };
}

test("guardAndMaybePause: disabled → never pauses even on depeg", async () => {
  const svc = new PriceMonitorService(depsWith(E18 / 2n)); // USDY depeg
  const { opts, paused } = guardDeps({ enabled: false });
  const res = await svc.guardAndMaybePause(opts);
  assert.equal(paused.length, 0);
  if (!(env.USE_MOCK_CONTRACTS || !addresses.priceFeed)) assert.equal(res.critical.length, 1);
});

test("guardAndMaybePause: enabled + depeg → pauses all vaults; no depeg → none", async () => {
  if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) return; // checkPrices is gated off

  const depeg = guardDeps();
  const r1 = await new PriceMonitorService(depsWith(E18 / 2n)).guardAndMaybePause(depeg.opts);
  assert.equal(r1.critical.length, 1);
  assert.deepEqual(depeg.paused, ["0x01", "0x02"]); // both vaults paused

  const healthy = guardDeps();
  const r2 = await new PriceMonitorService(depsWith(E18)).guardAndMaybePause(healthy.opts);
  assert.equal(r2.critical.length, 0);
  assert.equal(healthy.paused.length, 0);
});

test("checkFreshness: one stale feed flagged among fresh ones", async () => {
  const now = 1000n;
  const staleAddr = TOKENS.WMNT.address;
  const deps: PriceMonitorDeps = {
    readNow: async () => now,
    readMaxStaleness: async () => 100n,
    readPriceUnsafe: async (t) =>
      t === staleAddr ? ([0n, 0n] as const) : ([E18, now - 10n] as const),
  };
  const statuses = await new PriceMonitorService(deps).checkFreshness();

  // In mock mode (or no priceFeed) the service short-circuits to [].
  if (env.USE_MOCK_CONTRACTS || !addresses.priceFeed) {
    assert.deepEqual(statuses, []);
    return;
  }
  assert.equal(statuses.length, 5); // non-static tokens
  const stale = statuses.filter((s) => s.stale);
  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.symbol, "WMNT");
});
