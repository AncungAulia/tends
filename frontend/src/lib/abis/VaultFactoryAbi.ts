// ABI from implementation: 0x30c92fFadAd24Ca079227A92A33b78683D36Fde6
export const VaultFactoryAbi = [
  {
    type: "function",
    name: "deployVault",
    inputs: [],
    outputs: [{ name: "vault", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "vaultOf",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allVaults",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalVaults",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowedTokens",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "implementation",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VaultDeployed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "VaultAlreadyExists",
    inputs: [],
  },
] as const;
