import { test } from "node:test";
import assert from "node:assert/strict";
import { findCapViolations } from "../../../../src/agents/mastra/workflows/enforce-guardrails.js";

const h = (symbol: string, allocationPct: number) => ({ symbol, allocationPct });

test("findCapViolations: flags tokens over their cap (bps → %)", () => {
  const holdings = [h("sUSDe", 30), h("cmETH", 20), h("mUSD", 50)];
  // cap sUSDe at 25% (2500 bps): 30% > 25% → violation; cmETH cap 30% → ok
  assert.deepEqual(findCapViolations(holdings, { sUSDe: 2500, cmETH: 3000 }), ["sUSDe"]);
});

test("findCapViolations: exactly at cap is NOT a violation", () => {
  assert.deepEqual(findCapViolations([h("sUSDe", 25)], { sUSDe: 2500 }), []);
});

test("findCapViolations: no caps → no violations", () => {
  assert.deepEqual(findCapViolations([h("sUSDe", 90)], null), []);
  assert.deepEqual(findCapViolations([h("sUSDe", 90)], undefined), []);
  assert.deepEqual(findCapViolations([h("sUSDe", 90)], {}), []);
});

test("findCapViolations: multiple violations", () => {
  const holdings = [h("sUSDe", 40), h("cmETH", 35), h("mUSD", 25)];
  assert.deepEqual(
    findCapViolations(holdings, { sUSDe: 2000, cmETH: 3000, mUSD: 5000 }).sort(),
    ["cmETH", "sUSDe"],
  );
});
