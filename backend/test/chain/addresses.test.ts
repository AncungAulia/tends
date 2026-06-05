import { test } from "node:test";
import assert from "node:assert/strict";
import { addresses, as0x, coreContractsReady } from "../../src/chain/addresses.js";
import { env } from "../../src/config/env.js";

test("as0x is an identity cast", () => {
  assert.equal(as0x("0xabc"), "0xabc");
});

test("addresses are sourced from env", () => {
  assert.equal(addresses.vaultFactory, env.VAULT_FACTORY_ADDRESS);
  assert.equal(addresses.priceFeed, env.PRICE_FEED_ADDRESS);
  assert.equal(addresses.mockOracle, env.MOCK_ORACLE_ADDRESS);
});

test("coreContractsReady reflects mock flag + populated core addresses", () => {
  const expected =
    !env.USE_MOCK_CONTRACTS &&
    Boolean(
      env.VAULT_FACTORY_ADDRESS && env.PRICE_FEED_ADDRESS && env.ACTIVITY_LOG_ADDRESS,
    );
  assert.equal(coreContractsReady(), expected);
});
