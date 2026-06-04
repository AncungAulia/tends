import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
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

test("Decimal serializes as a plain (non-exponential) string, BigInt-able", () => {
  const shares = new Prisma.Decimal("1500000000000000000000000"); // 1.5e24 integer
  const s = (JSON.parse(JSON.stringify({ shares })) as { shares: string }).shares;
  assert.equal(s, "1500000000000000000000000"); // not "1.5e+24"
  assert.equal(BigInt(s).toString(), "1500000000000000000000000");
  // small decimals unaffected
  assert.equal(JSON.parse(JSON.stringify({ apy: new Prisma.Decimal("5.25") })).apy, "5.25");
});
