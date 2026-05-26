// ABI from implementation: 0x020744cC10fEaD789dE205de76A2769B9A4945DE
// Prices are scaled 1e18 (18 decimals). Divide by 1e18 for a USD value.
export const PriceFeedAbi = [
  {
    type: "function",
    name: "getPrice",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPriceUnsafe",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updateTime", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "staticPrices",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "feedIds",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "NoFeedConfigured",
    inputs: [{ name: "token", type: "address" }],
  },
  {
    type: "error",
    name: "StalePrice",
    inputs: [
      { name: "token", type: "address" },
      { name: "updatedAt", type: "uint256" },
      { name: "elapsed", type: "uint256" },
    ],
  },
] as const;
