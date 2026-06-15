import { test } from "node:test";
import assert from "node:assert/strict";
import { listStrategies, getStrategy, riskLevelFromId } from "../src/strategies.js";
import { currentApy } from "../src/services/projection.js";

// APY map covering all tokens referenced by STRATEGY (missing → 0 in blendedApy)
const APY = {
  mUSD: 5, USDY: 5, sUSDe: 10, VBILL: 5, CETES: 9, GILTS: 4.5, TESOURO: 6,
  XAU: 0, USA500: 8, AAPL: 8, MSFT: 10, mETH: 4, cmETH: 4, WMNT: 1, EUR: 0,
};

test("blended APY follows the risk ladder: LOW < MEDIUM < HIGH (default APYs)", () => {
  const byId = Object.fromEntries(
    listStrategies(currentApy()).map((s) => [s.id, s.blendedApyPct]),
  );
  assert.ok(byId.LOW! < byId.MEDIUM!, `LOW ${byId.LOW} < MEDIUM ${byId.MEDIUM}`);
  assert.ok(byId.MEDIUM! < byId.HIGH!, `MEDIUM ${byId.MEDIUM} < HIGH ${byId.HIGH}`);
  // HIGH must be materially higher than LOW (not a hair) — ≥ 1.5× the LOW yield
  assert.ok(byId.HIGH! >= byId.LOW! * 1.5, `HIGH ${byId.HIGH} ≥ 1.5×LOW ${byId.LOW}`);
});

test("listStrategies: returns all four with blended APY (CUSTOM null)", () => {
  const list = listStrategies(APY);
  assert.deepEqual(list.map((s) => s.id), ["LOW", "MEDIUM", "HIGH", "CUSTOM"]);
  // LOW: 70% mUSD(5) + 10% USDY(5) + 10% GILTS(4.5) + 5% XAU(0) + 5% EUR(0)
  //    = (7000*5 + 1000*5 + 1000*4.5) / 10000 = 4.45
  assert.equal(list.find((s) => s.id === "LOW")!.blendedApyPct, 4.45);
  assert.equal(list.find((s) => s.id === "CUSTOM")!.blendedApyPct, null);
  // MEDIUM has diverse tokens including indices+stocks — verify it has a positive blended APY
  assert.ok((list.find((s) => s.id === "MEDIUM")!.blendedApyPct ?? 0) > 0);
});

test("getStrategy: found / not found", () => {
  assert.equal(getStrategy("LOW")!.id, "LOW");
  assert.equal(getStrategy("NOPE"), null);
});

test("riskLevelFromId: maps ids to on-chain enum", () => {
  assert.equal(riskLevelFromId("LOW"), 0);
  assert.equal(riskLevelFromId("MEDIUM"), 1);
  assert.equal(riskLevelFromId("HIGH"), 2);
  assert.equal(riskLevelFromId("CUSTOM"), 3);
  assert.equal(riskLevelFromId("???"), null);
});
