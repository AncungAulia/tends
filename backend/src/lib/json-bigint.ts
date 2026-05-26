// Prisma returns BigInt for some columns (Vault.deployedBlock, AgentActivity.id /
// blockNumber). JSON.stringify throws on BigInt ("Do not know how to serialize a
// BigInt"), which 500s any response carrying one (e.g. GET /api/users/me/position,
// /activity) and breaks MCP tool results. Importing this module (for its side effect)
// makes BigInt serialize as a decimal string everywhere in the process.
//
// The frontend treats these fields as strings (ids/block numbers; not used in math).
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
