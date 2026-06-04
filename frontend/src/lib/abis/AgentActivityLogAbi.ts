// ABI from implementation: 0x56CeD9fD5E49C1Aba1371D7aDe383DD16da76484
// Used to display agent activity history (rebalance log) on-chain.
export const AgentActivityLogAbi = [
  {
    type: "function",
    name: "totalActivities",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRecentActivities",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "result",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "vault", type: "address" },
          { name: "agent", type: "address" },
          { name: "action", type: "string" },
          { name: "metadata", type: "bytes" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActivitiesByVault",
    inputs: [
      { name: "vault", type: "address" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "result",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "vault", type: "address" },
          { name: "agent", type: "address" },
          { name: "action", type: "string" },
          { name: "metadata", type: "bytes" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ActivityLogged",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
