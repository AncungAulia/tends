import { test } from "node:test";
import assert from "node:assert/strict";
import { PricingService } from "./pricing.js";

const realFetch = globalThis.fetch;

function stubFetch(impl: () => { ok: boolean; json?: () => Promise<unknown> }) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return impl() as unknown as Response;
  }) as typeof fetch;
  return () => calls;
}

test("getPrice fetches, returns USD value, and caches across symbols", async () => {
  const callCount = stubFetch(() => ({
    ok: true,
    json: async () => ({ "usd-coin": { usd: 1 }, mantle: { usd: 0.5 } }),
  }));
  try {
    const svc = new PricingService();
    assert.equal(await svc.getPrice("USDC"), 1);
    // second lookup is served from cache (no extra fetch)
    assert.equal(await svc.getPrice("MNT"), 0.5);
    assert.equal(callCount(), 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("getPrice returns 0 when the asset is missing from the response", async () => {
  stubFetch(() => ({ ok: true, json: async () => ({ "usd-coin": { usd: 1 } }) }));
  try {
    const svc = new PricingService();
    assert.equal(await svc.getPrice("sUSDe"), 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("getPrice returns 0 on a failed (non-ok) response", async () => {
  stubFetch(() => ({ ok: false }));
  try {
    const svc = new PricingService();
    assert.equal(await svc.getPrice("USDC"), 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
