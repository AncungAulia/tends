import { test } from "node:test";
import assert from "node:assert/strict";
import { listStrategies, getStrategy, riskLevelFromId } from "../src/strategies.js";
import { currentApy } from "../src/services/projection.js";

const APY = { mUSD: 5, USDY: 5, mETH: 4, cmETH: 4, sUSDe: 10, WMNT: 1 };

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
  assert.equal(list.find((s) => s.id === "LOW")!.blendedApyPct, 5); // 90/10 of 5/5
  assert.equal(list.find((s) => s.id === "CUSTOM")!.blendedApyPct, null);
  // MEDIUM: 40% mUSD(5) + 30% mETH(4) + 30% cmETH(4) = 2 + 1.2 + 1.2 = 4.4
  assert.equal(list.find((s) => s.id === "MEDIUM")!.blendedApyPct, 4.4);
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
