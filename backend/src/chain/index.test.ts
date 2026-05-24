import { test } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { agentAddress, getAgentWallet, activeChain } from "./index.js";
import { env } from "../config/env.js";

test("activeChain resolves from CHAIN_ID", () => {
  assert.equal(activeChain.id, env.CHAIN_ID);
});

test("agentAddress / getAgentWallet derive from the configured key", () => {
  if (!env.PRIVATE_KEY_AGENT_EXECUTOR) {
    assert.equal(agentAddress(), null);
    assert.throws(() => getAgentWallet());
    return;
  }
  const expected = privateKeyToAccount(
    env.PRIVATE_KEY_AGENT_EXECUTOR as `0x${string}`,
  ).address;
  assert.equal(agentAddress(), expected);

  const w = getAgentWallet();
  assert.equal(w.account?.address, expected);
  assert.equal(w.chain?.id, env.CHAIN_ID);
  // memoized — same instance on repeat calls
  assert.equal(getAgentWallet(), w);
});
