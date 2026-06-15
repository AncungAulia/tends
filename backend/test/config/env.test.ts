import { test } from "node:test";
import assert from "node:assert/strict";
import { envSchema } from "../../src/config/env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  MANTLE_RPC_URL: "https://rpc.sepolia.mantle.xyz",
};

test("applies sensible defaults", () => {
  const e = envSchema.parse(base);
  assert.equal(e.NODE_ENV, "development");
  assert.equal(e.PORT, 3001);
  assert.equal(e.LOG_LEVEL, "info");
  assert.equal(e.CHAIN_ID, 5003);
  assert.equal(e.USE_MOCK_CONTRACTS, true);
  assert.equal(e.RELAYER_ENABLED, false);
  assert.equal(e.RELAYER_INTERVAL_SEC, 3600);
  assert.equal(e.MOCK_ORACLE_ADDRESS, "0x26f9178b4082b68D8cC55874D377f9829Fc8C22d");
  assert.equal(e.USDY_ORACLE_ADDRESS, "0xA96abbe61AfEdEB0D14a20440Ae7100D9aB4882f");
  assert.equal(e.MANTLE_MAINNET_RPC, "https://rpc.mantle.xyz");
});

test("USE_MOCK_CONTRACTS string → boolean", () => {
  assert.equal(envSchema.parse({ ...base, USE_MOCK_CONTRACTS: "false" }).USE_MOCK_CONTRACTS, false);
  assert.equal(envSchema.parse({ ...base, USE_MOCK_CONTRACTS: "true" }).USE_MOCK_CONTRACTS, true);
});

test("RELAYER_ENABLED string → boolean", () => {
  assert.equal(envSchema.parse({ ...base, RELAYER_ENABLED: "true" }).RELAYER_ENABLED, true);
});

test("coerces numeric env vars", () => {
  const e = envSchema.parse({ ...base, CHAIN_ID: "5000", PORT: "8080", RELAYER_INTERVAL_SEC: "1800" });
  assert.equal(e.CHAIN_ID, 5000);
  assert.equal(e.PORT, 8080);
  assert.equal(e.RELAYER_INTERVAL_SEC, 1800);
});

test("missing required vars fail validation", () => {
  // DATABASE_URL required
  assert.equal(envSchema.safeParse({ MANTLE_RPC_URL: base.MANTLE_RPC_URL }).success, false);
  // MANTLE_RPC_URL required
  assert.equal(envSchema.safeParse({ DATABASE_URL: base.DATABASE_URL }).success, false);
});

test("REDIS_URL is optional (Redis not consumed yet)", () => {
  const e = envSchema.parse({ DATABASE_URL: base.DATABASE_URL, MANTLE_RPC_URL: base.MANTLE_RPC_URL });
  assert.ok(e); // parses fine without REDIS_URL
});

test("rejects invalid enum / non-numeric / bad url", () => {
  assert.equal(envSchema.safeParse({ ...base, LOG_LEVEL: "loud" }).success, false);
  assert.equal(envSchema.safeParse({ ...base, USE_MOCK_CONTRACTS: "maybe" }).success, false);
  assert.equal(envSchema.safeParse({ ...base, PORT: "abc" }).success, false);
  assert.equal(envSchema.safeParse({ ...base, DATABASE_URL: "not-a-url" }).success, false);
});

test("optional address fields default to empty string", () => {
  const e = envSchema.parse(base);
  assert.equal(e.VAULT_FACTORY_ADDRESS, "");
  assert.equal(e.PRICE_FEED_ADDRESS, "");
  assert.equal(e.USDC_ADDR, "");
});
