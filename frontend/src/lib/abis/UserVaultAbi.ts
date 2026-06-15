// ABI from implementation: 0xfdb083371f44Cf53181350389D3217e51B431776
// UserVault is an ERC-4626 vault. Each user has their own proxy address —
// resolve it via VaultFactory.vaultOf(userAddress).
export const UserVaultAbi = [
  // ── ERC-4626 core ──────────────────────────────────────────────────────
  {
    type: "function",
    name: "asset",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "redeem",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "convertToShares",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewDeposit",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "previewWithdraw",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxDeposit",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "maxWithdraw",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  // ── Deposit helpers ─────────────────────────────────────────────────────
  {
    type: "function",
    name: "depositWithPermit",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositNative",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "payable",
  },
  // ── Risk preference ─────────────────────────────────────────────────────
  {
    type: "function",
    name: "riskPreference",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "customAllocation",
    inputs: [],
    outputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setRiskLevel",
    inputs: [{ name: "level", type: "uint8" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setCustomAllocation",
    inputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── State ───────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastRebalanceTime",
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
    name: "isAllowedToken",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Rebalanced",
    inputs: [
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "agent", type: "address", indexed: true },
      {
        name: "instructions",
        type: "tuple[]",
        indexed: false,
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RiskPreferenceUpdated",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "level", type: "uint8", indexed: false },
      { name: "lowBps", type: "uint16", indexed: false },
      { name: "medBps", type: "uint16", indexed: false },
      { name: "highBps", type: "uint16", indexed: false },
    ],
    anonymous: false,
  },
  // ── Errors ──────────────────────────────────────────────────────────────
  { type: "error", name: "VaultPaused", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "InvalidAllocationSum", inputs: [] },
] as const;
