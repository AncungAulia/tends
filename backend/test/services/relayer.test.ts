import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnits, stringToHex } from "viem";
import {
  buildRedstoneEntries,
  toWad,
  feedKey,
  RelayerService,
  type RelayerDeps,
} from "../../src/services/relayer.js";

test("toWad: float → 18-dec bigint", () => {
  assert.equal(toWad(1.05), parseUnits("1.05", 18));
  assert.equal(toWad(2000), 2000n * 10n ** 18n);
});

test("feedKey: right-padded bytes32", () => {
  assert.equal(feedKey("MNT"), stringToHex("MNT", { size: 32 }));
});

test("buildRedstoneEntries: plain values pass through", () => {
  const feeds = { ETH: "ETH", FOO: "FOO_SRC" };
  const out = buildRedstoneEntries({ ETH: 2000, FOO_SRC: 1.5 }, feeds, new Set());
  assert.equal(out.length, 2);
  assert.equal(out.find((e) => e.id === "FOO")!.wad, toWad(1.5));
});

test("buildRedstoneEntries: rate×ETH tokens converted to USD", () => {
  const feeds = { ETH: "ETH", mETH_FUNDAMENTAL: "mETH_FUNDAMENTAL" };
  const out = buildRedstoneEntries(
    { ETH: 2000, mETH_FUNDAMENTAL: 1.1 },
    feeds,
    new Set(["mETH_FUNDAMENTAL"]),
  );
  const meth = out.find((e) => e.id === "mETH_FUNDAMENTAL")!;
  assert.equal(meth.human, 2200); // 1.1 × 2000
  assert.equal(meth.wad, toWad(2200));
});

test("buildRedstoneEntries: missing source is skipped", () => {
  const feeds = { ETH: "ETH", GONE: "GONE_SRC" };
  const out = buildRedstoneEntries({ ETH: 2000 }, feeds, new Set());
  assert.deepEqual(out.map((e) => e.id), ["ETH"]);
});

test("buildRedstoneEntries: rate token skipped when ETH price absent", () => {
  const feeds = { mETH_FUNDAMENTAL: "mETH_FUNDAMENTAL" };
  const out = buildRedstoneEntries(
    { mETH_FUNDAMENTAL: 1.1 },
    feeds,
    new Set(["mETH_FUNDAMENTAL"]),
  );
  assert.equal(out.length, 0);
});

function fakeDeps(overrides: Partial<RelayerDeps> = {}): {
  deps: RelayerDeps;
  pushed: { ids: readonly `0x${string}`[]; values: readonly bigint[] }[];
} {
  const pushed: { ids: readonly `0x${string}`[]; values: readonly bigint[] }[] = [];
  const deps: RelayerDeps = {
    fetchRedstoneRaw: async () => ({ ETH: 2000, MNT: 0.5, sUSDe: 1.2 }),
    fetchUsdyWad: async () => toWad(1.07),
    pushPrices: async (ids, values) => {
      pushed.push({ ids, values });
      return "0xhash";
    },
    ...overrides,
  };
  return { deps, pushed };
}

test("collectEntries: USDY is first, value from the Ondo oracle", async () => {
  const { deps } = fakeDeps();
  const entries = await new RelayerService(deps).collectEntries();
  assert.equal(entries[0]!.id, "USDY");
  assert.equal(entries[0]!.wad, toWad(1.07));
  // MNT comes from the fake redstone raw
  assert.equal(entries.find((e) => e.id === "MNT")!.wad, toWad(0.5));
});

test("relayOnce: pushes feedKey/wad arrays of equal length and returns the hash", async () => {
  const { deps, pushed } = fakeDeps();
  const result = await new RelayerService(deps).relayOnce();
  assert.deepEqual(result?.hashes, ["0xhash"]); // Fase 2: returns { hashes, materialTokens }
  assert.equal(pushed.length, 1);
  const { ids, values } = pushed[0]!;
  assert.equal(ids.length, values.length);
  assert.ok(ids.length >= 1);
  assert.equal(ids[0], feedKey("USDY")); // USDY pushed first
  assert.equal(values[0], toWad(1.07));
});

test("relayOnce: surfaces push failures", async () => {
  const { deps } = fakeDeps({
    pushPrices: async () => {
      throw new Error("rpc down");
    },
  });
  await assert.rejects(() => new RelayerService(deps).relayOnce(), /rpc down/);
});
