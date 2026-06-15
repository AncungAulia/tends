// ABIs lifted from backend/INTEGRATION.md (smart-contract team). Only the
// surfaces the backend touches are included — kept `as const` for viem typing.

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/** Tx-building surface of UserVault/VaultFactory (deposit/withdraw/config/deploy). */
export const USER_VAULT_TX_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    // ERC-2612 permit + deposit in one tx (MockUSDC is ERC20Permit)
    name: "depositWithPermit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "setRiskLevel",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "level", type: "uint8" }],
    outputs: [],
  },
  {
    name: "setCustomAllocation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
    outputs: [],
  },
  {
    // callable by owner OR agentExecutor (our agent wallet)
    name: "emergencyPause",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "reason", type: "string" }],
    outputs: [],
  },
  {
    // onlyAgent — called by backend before returning withdraw tx
    name: "agentLiquidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const VAULT_FACTORY_TX_ABI = [
  {
    name: "deployVault",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "vault", type: "address" }],
  },
] as const;

// NOTE: the deployed PriceFeed is PULL-based — it reads live from MockOracle on
// getPrice(). There is no pushPrices() (INTEGRATION.md §1 is outdated). Prices are
// fed into MockOracle by an external relayer (~hourly), not by this backend.
export const PRICE_FEED_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "price", type: "uint256" }],
  },
  {
    name: "getPriceUnsafe",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    name: "maxStaleness",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const MOCK_ORACLE_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "feedId", type: "bytes32" }],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "updatedAt", type: "uint64" },
    ],
  },
  {
    // onlyRelayer — our AGENT_EXECUTOR is authorized (RELAYER-HANDOFF.md).
    name: "setPrices",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feedIds", type: "bytes32[]" },
      { name: "values", type: "uint256[]" },
    ],
    outputs: [],
  },
] as const;

/** Ondo USDY oracle on Mantle MAINNET — getPrice() returns 18-dec USD. */
export const USDY_ORACLE_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const VAULT_FACTORY_ABI = [
  {
    name: "vaultOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "allVaults",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "totalVaults",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "batchAddTokensToVaults",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokens", type: "address[]" }],
    outputs: [],
  },
  {
    name: "VaultDeployed",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "vault", type: "address", indexed: true },
    ],
  },
] as const;

const SWAP_INSTRUCTION = {
  name: "instructions",
  type: "tuple[]",
  components: [
    { name: "tokenIn", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "amountIn", type: "uint256" },
    { name: "minAmountOut", type: "uint256" },
  ],
} as const;

export const USER_VAULT_SETUP_ABI = [
  {
    name: "addAllowedTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokens", type: "address[]" }],
    outputs: [],
  },
  {
    name: "isAllowedToken",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const USER_VAULT_ABI = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }], // the user this vault belongs to
  },
  {
    name: "riskPreference",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }], // 0=LOW 1=MEDIUM 2=HIGH 3=CUSTOM
  },
  {
    name: "customAllocation",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "lowBps", type: "uint16" },
      { name: "medBps", type: "uint16" },
      { name: "highBps", type: "uint16" },
    ],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }], // USDC, 6 decimals
  },
  {
    name: "lastRebalanceTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "minRebalanceInterval",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "setMinRebalanceInterval",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "interval", type: "uint256" }],
    outputs: [],
  },
  {
    name: "MinRebalanceIntervalUpdated",
    type: "event",
    inputs: [
      { name: "oldInterval", type: "uint256", indexed: false },
      { name: "newInterval", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CooldownNotElapsed",
    type: "error",
    inputs: [{ name: "availableAt", type: "uint256" }],
  },
  {
    name: "setAllowedToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "AllowedTokenUpdated",
    type: "event",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "allowed", type: "bool", indexed: false },
    ],
  },
  {
    name: "rebalance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [SWAP_INSTRUCTION],
    outputs: [],
  },
  {
    // onlyAgent — called by backend before returning withdraw tx
    name: "agentLiquidate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "Rebalanced",
    type: "event",
    inputs: [
      { name: "timestamp", type: "uint256", indexed: false },
      { name: "agent", type: "address", indexed: true },
      { ...SWAP_INSTRUCTION, indexed: false },
    ],
  },
  {
    // ERC-4626 standard
    name: "Deposit",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Withdraw",
    type: "event",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    name: "RiskPreferenceUpdated",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "level", type: "uint8", indexed: false },
      { name: "lowBps", type: "uint16", indexed: false },
      { name: "medBps", type: "uint16", indexed: false },
      { name: "highBps", type: "uint16", indexed: false },
    ],
  },
] as const;

export const ACTIVITY_LOG_ABI = [
  {
    name: "logActivity",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "action", type: "string" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getRecentActivities",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "agent", type: "address" },
          { name: "vault", type: "address" },
          { name: "action", type: "string" },
          { name: "metadata", type: "bytes" },
          { name: "timestamp", type: "uint256" },
          { name: "blockNumber", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "ActivityLogged",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "agent", type: "address", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
