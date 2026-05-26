import { test } from "node:test";
import assert from "node:assert/strict";
import "./json-bigint.js";

test("BigInt serializes to a decimal string (no throw, no precision loss)", () => {
  assert.equal(JSON.stringify(10n), '"10"');
  assert.equal(JSON.stringify({ id: 42n, n: null }), '{"id":"42","n":null}');
  // beyond Number.MAX_SAFE_INTEGER — must stay exact as a string
  assert.equal(
    JSON.stringify({ block: 12345678901234567890n }),
    '{"block":"12345678901234567890"}',
  );
});
