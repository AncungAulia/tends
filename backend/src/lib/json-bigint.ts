import { Prisma } from "@prisma/client";

// JSON-serialization fixups for the values Prisma hands back. Imported for side
// effect at the top of index.ts (API) and mcp/server.ts (tool results).

// 1. BigInt columns (Vault.deployedBlock, AgentActivity.id/blockNumber): JSON.stringify
//    throws on BigInt → serialize as a decimal string.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

// 2. Decimal columns (Vault.shares/initialDeposit are Decimal(78,0)): decimal.js
//    defaults to EXPONENTIAL notation for large values (e.g. "1.5e+24"), which the
//    frontend can't BigInt(). Disable exponential so they serialize as plain integer
//    strings, BigInt-able and precision-safe.
Prisma.Decimal.set({ toExpPos: 1_000_000_000, toExpNeg: -1_000_000_000 });
