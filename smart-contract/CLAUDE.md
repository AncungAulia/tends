# CLAUDE.md — Tends Smart Contracts

> **Project**: Tends (tends.fun)
> **Tagline**: "Fire your analyst, deploy your agent."
> **Chain**: Mantle Sepolia Testnet (Chain ID: 5003)
> **Framework**: Foundry + Solidity 0.8.24+
> **Pattern**: UUPS Upgradeable (OpenZeppelin)
> **Hackathon**: Mantle Turing Test 2026 — AI & RWA Track

---

## Project Context

Tends is an AI-managed RWA yield aggregator on Mantle. Users deposit USDC, pick a risk strategy (or mix their own), and an AI agent autonomously allocates and rebalances across real-world assets like mUSD, USDY, mETH, cmETH, sUSDe.

**Core innovation**: Composite vault architecture allowing custom strategy mix (Low + Medium + High percentages), with autonomous agent execution for rebalancing internal allocations.

**Hackathon scope**: 100% Mantle Sepolia testnet. All RWA tokens deployed as mocks with real-world symbols/names. Pricing via backend-pushed PriceFeed (no decentralized oracle for hackathon).

---

## Bahasa Komunikasi

User communicates in mix Bahasa Indonesia + English (natural code-switch). Respond same way when explaining or asking clarification. Code comments stay English.

Style preferences:
- No em dashes
- Direct, concise
- Push back honestly when there's a better approach
- Concrete with code, not abstract

---

## Architecture Overview

```
                ┌──────────────────────┐
                │   CompositeVault     │  ← User custom mix
                │   (UUPS, ERC-4626)   │
                └──────────┬───────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌────────┐         ┌──────────┐      ┌──────────┐
   │LowVault│         │MediumVault│     │HighVault │
   │ (UUPS) │         │ (UUPS)   │      │ (UUPS)   │
   └────┬───┘         └────┬─────┘      └────┬─────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                  ┌─────────────────┐
                  │ StrategyRouter  │  ← Mock DEX swap
                  │ (UUPS)          │
                  └─────────────────┘
                           │
                           ▼
                    MockDexAdapter
                    (reads PriceFeed)

   PriceFeed (UUPS) ← BE pushes prices periodically
   AgentActivityLog (UUPS) ← all agent actions logged
```

---

## Strategies

| Strategy | Vault | Allocation |
|---|---|---|
| LOW | LowVault | 90% mUSD + 10% USDY |
| MEDIUM | MediumVault | 40% mUSD + 30% mETH + 30% cmETH |
| HIGH | HighVault | 40% cmETH + 30% sUSDe + 20% mETH + 10% MNT |
| CUSTOM | CompositeVault | User-defined mix of Low/Med/High |

### Custom Strategy Math

User picks `lowBps + medBps + highBps = 10000` (basis points).

CompositeVault distributes USDC deposit:
```
lowAmount  = (deposit * lowBps)  / 10000
medAmount  = (deposit * medBps)  / 10000
highAmount = deposit - lowAmount - medAmount  // dust handling
```

Each base vault then internally splits per its own target allocation.

---

## Signature & Authority Model

| Action | Authority | User Sign |
|---|---|---|
| Deposit | User wallet | 1 (ERC-2612 permit + deposit combined) |
| Withdraw | User wallet | 1 (standard ERC-4626 withdraw) |
| Set custom allocation | User wallet | 1 |
| Rebalance internal | `agentExecutor` (BE hot wallet) | 0 |
| Update prices | `priceUpdater` (BE hot wallet) | 0 |
| Emergency pause | Owner OR agentExecutor | 0 |
| Upgrade implementation | Owner only | Admin |

**Key principle**: Agent has authority to rebalance internal allocations (swap assets within whitelist), but CANNOT withdraw funds to external addresses. Worst-case agent compromise = bad swaps within vault, not user fund drain.

---

## Pricing Strategy (Hackathon Scope)

**Backend-pushed PriceFeed contract** instead of decentralized oracle.

- BE service runs every 5 minutes
- Fetches prices from CoinGecko (mainnet equivalents)
- Calls `PriceFeed.setPrices()` on-chain
- All vault math reads from PriceFeed

**Why**: RWA oracle coverage on Mantle Sepolia is poor. Real Pyth/Chainlink integration is production roadmap, not hackathon scope.

**Pitch story**: "BE-driven pricing for hackathon velocity. Production roadmap: migrate to Pyth Network for full decentralization."

---

## UUPS Upgradeable Pattern

### Why UUPS

- Allows iterating contracts during hackathon (fix bugs without losing user positions)
- Lower gas cost vs Transparent Proxy
- OpenZeppelin Upgradeable libs (already installed)

### Rules (CRITICAL)

1. **NO constructor logic** — use `initialize()` function instead
2. **Disable initializers in implementation constructor**:
   ```solidity
   /// @custom:oz-upgrades-unsafe-allow constructor
   constructor() {
       _disableInitializers();
   }
   ```
3. **Storage layout cannot change** — only append new variables to end
4. **Storage gaps in inherited contracts**:
   ```solidity
   uint256[50] private __gap;
   ```
5. **Authorize upgrades via `_authorizeUpgrade()`** — owner only
6. **Mocks are NOT upgradeable** — keep simple ERC-20s
7. **Use `initializer` modifier on init function**
8. **Inherited init functions chained with `__X_init()` pattern**

### Standard Upgradeable Imports

```solidity
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
```

### Foundry Upgrades Plugin

```solidity
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";
```

---

## Tech Stack

```
Solidity:     0.8.24+
Framework:    Foundry (forge, cast, anvil)
Network:      Mantle Sepolia (Chain ID: 5003)
RPC:          https://rpc.sepolia.mantle.xyz
Explorer:     https://explorer.sepolia.mantle.xyz

Libraries:    
  - @openzeppelin/contracts (mock tokens)
  - @openzeppelin/contracts-upgradeable (core contracts)
  - @openzeppelin-foundry-upgrades (deploy/test helpers)
  - forge-std
```

### Foundry Config

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
optimizer = true
optimizer_runs = 200
via_ir = true
ffi = true                            # needed for upgrades plugin
ast = true                            # needed for storage layout check
build_info = true
extra_output = ["storageLayout"]
fs_permissions = [
  { access = "read", path = "./deployments" },
  { access = "read-write", path = "./broadcast" }
]

[rpc_endpoints]
mantle_sepolia = "https://rpc.sepolia.mantle.xyz"

[etherscan]
mantle_sepolia = { key = "${MANTLESCAN_KEY}", url = "https://api-sepolia.mantlescan.xyz/api" }
```

### Remappings

```
# remappings.txt
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
@openzeppelin/contracts-upgradeable/=lib/openzeppelin-contracts-upgradeable/contracts/
@openzeppelin-foundry-upgrades/=lib/openzeppelin-foundry-upgrades/src/
forge-std/=lib/forge-std/src/
```

---

## Repository Structure

```
tends/
├── foundry.toml
├── .env.example
├── remappings.txt
├── README.md
├── lib/                                # Foundry submodules
│   ├── openzeppelin-contracts/
│   ├── openzeppelin-contracts-upgradeable/
│   ├── openzeppelin-foundry-upgrades/
│   └── forge-std/
├── src/
│   ├── vaults/
│   │   ├── BaseVault.sol               # Abstract UUPS ERC-4626
│   │   ├── LowVault.sol                # UUPS
│   │   ├── MediumVault.sol             # UUPS
│   │   ├── HighVault.sol               # UUPS
│   │   └── CompositeVault.sol          # UUPS
│   ├── routers/
│   │   └── StrategyRouter.sol          # UUPS
│   ├── pricing/
│   │   └── PriceFeed.sol               # UUPS, BE-pushed prices
│   ├── logs/
│   │   └── AgentActivityLog.sol        # UUPS
│   ├── interfaces/
│   │   ├── IVault.sol
│   │   ├── IStrategyRouter.sol
│   │   ├── IPriceFeed.sol
│   │   ├── IAgentActivityLog.sol
│   │   └── IDexAdapter.sol
│   ├── adapters/
│   │   └── MockDexAdapter.sol          # Non-upgradeable
│   └── mocks/                          # Non-upgradeable mocks
│       ├── MockUSDC.sol                # name: "USD Coin", symbol: "USDC"
│       ├── MockMUSD.sol                # name: "Mantle USD", symbol: "mUSD"
│       ├── MockUSDY.sol                # name: "Ondo US Dollar Yield", symbol: "USDY"
│       ├── MockMETH.sol                # name: "Mantle Staked Ether", symbol: "mETH"
│       ├── MockCMETH.sol               # name: "Cumulative Mantle Staked Ether", symbol: "cmETH"
│       ├── MockSUSDE.sol               # name: "Staked USDe", symbol: "sUSDe"
│       └── MockWMNT.sol                # name: "Wrapped Mantle", symbol: "WMNT"
├── test/
│   ├── unit/
│   │   ├── PriceFeed.t.sol
│   │   ├── BaseVault.t.sol
│   │   ├── LowVault.t.sol
│   │   ├── MediumVault.t.sol
│   │   ├── HighVault.t.sol
│   │   ├── CompositeVault.t.sol
│   │   ├── StrategyRouter.t.sol
│   │   └── AgentActivityLog.t.sol
│   ├── integration/
│   │   ├── DepositWithdrawFlow.t.sol
│   │   ├── RebalanceFlow.t.sol
│   │   ├── CustomStrategyFlow.t.sol
│   │   ├── EmergencyPauseFlow.t.sol
│   │   └── UpgradeFlow.t.sol           # Test upgradeability
│   └── helpers/
│       ├── BaseTest.sol
│       └── Fixtures.sol
├── script/
│   ├── DeployMocks.s.sol               # Deploy mock tokens
│   ├── DeployCore.s.sol                # Deploy UUPS proxies
│   ├── Configure.s.sol                 # Setup authorizations
│   ├── FundMocks.s.sol                 # Mint mock tokens for testing
│   └── UpgradeContract.s.sol           # Example upgrade script
└── deployments/
    └── mantle-sepolia.json
```

---

## Mock Tokens — Real-World Names

**Important**: Mock tokens use **real-world names and symbols** on-chain so users see exact same UX as mainnet. File/class names are `Mock*` for code organization only.

### Example: MockMETH.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Mock mETH (Mantle Staked Ether) for Mantle Sepolia testnet
/// @dev Internal class name MockMETH, but on-chain name/symbol are real
contract MockMETH is ERC20, ERC20Permit {
    constructor() 
        ERC20("Mantle Staked Ether", "mETH")
        ERC20Permit("Mantle Staked Ether")
    {
        _mint(msg.sender, 1_000_000 ether);
    }
    
    /// @notice Open faucet for testnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

### All Mock Token Specs

| File | Contract | name() | symbol() | decimals |
|---|---|---|---|---|
| MockUSDC.sol | MockUSDC | USD Coin | USDC | 6 |
| MockMUSD.sol | MockMUSD | Mantle USD | mUSD | 18 |
| MockUSDY.sol | MockUSDY | Ondo US Dollar Yield | USDY | 18 |
| MockMETH.sol | MockMETH | Mantle Staked Ether | mETH | 18 |
| MockCMETH.sol | MockCMETH | Cumulative Mantle Staked Ether | cmETH | 18 |
| MockSUSDE.sol | MockSUSDE | Staked USDe | sUSDe | 18 |
| MockWMNT.sol | MockWMNT | Wrapped Mantle | WMNT | 18 |

**All mocks include**:
- `ERC20Permit` for ERC-2612 support (frontend signature flows)
- Open `mint(to, amount)` function (faucet for testnet)
- Pre-mint 1M to deployer
- Standard `ERC20` (NOT upgradeable, mocks stay simple)
- **MockUSDC must override `decimals()` to return 6** (others default to 18)

---

## Contract Specifications

### 1. PriceFeed.sol (UUPS)

Backend-pushed price storage. NOT a decentralized oracle.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract PriceFeed is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // === Storage ===
    address public priceUpdater;
    uint256 public maxStaleness;
    
    mapping(address => uint256) public prices;        // token => USD price (1e18 decimals)
    mapping(address => uint256) public lastUpdated;
    
    uint256[47] private __gap;
    
    // === Events ===
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event PriceUpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    event MaxStalenessChanged(uint256 oldStaleness, uint256 newStaleness);
    
    // === Errors ===
    error NotAuthorized();
    error StalePrice(address token, uint256 lastUpdate, uint256 staleness);
    error ArrayLengthMismatch();
    error InvalidAddress();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _owner, address _priceUpdater) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        priceUpdater = _priceUpdater;
        maxStaleness = 1 hours;
    }
    
    modifier onlyUpdater() {
        if (msg.sender != priceUpdater) revert NotAuthorized();
        _;
    }
    
    function setPrices(address[] calldata tokens, uint256[] calldata newPrices) external onlyUpdater {
        if (tokens.length != newPrices.length) revert ArrayLengthMismatch();
        for (uint i = 0; i < tokens.length; i++) {
            prices[tokens[i]] = newPrices[i];
            lastUpdated[tokens[i]] = block.timestamp;
            emit PriceUpdated(tokens[i], newPrices[i], block.timestamp);
        }
    }
    
    function setPrice(address token, uint256 price) external onlyUpdater {
        prices[token] = price;
        lastUpdated[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    function getPrice(address token) external view returns (uint256) {
        uint256 lastUpdate = lastUpdated[token];
        if (block.timestamp - lastUpdate > maxStaleness) {
            revert StalePrice(token, lastUpdate, block.timestamp - lastUpdate);
        }
        return prices[token];
    }
    
    function getPriceUnsafe(address token) external view returns (uint256 price, uint256 updateTime) {
        return (prices[token], lastUpdated[token]);
    }
    
    function setPriceUpdater(address newUpdater) external onlyOwner {
        if (newUpdater == address(0)) revert InvalidAddress();
        address oldUpdater = priceUpdater;
        priceUpdater = newUpdater;
        emit PriceUpdaterChanged(oldUpdater, newUpdater);
    }
    
    function setMaxStaleness(uint256 newStaleness) external onlyOwner {
        uint256 oldStaleness = maxStaleness;
        maxStaleness = newStaleness;
        emit MaxStalenessChanged(oldStaleness, newStaleness);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### 2. BaseVault.sol (Abstract UUPS)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";
import {IStrategyRouter} from "../interfaces/IStrategyRouter.sol";
import {IAgentActivityLog} from "../interfaces/IAgentActivityLog.sol";

abstract contract BaseVault is 
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // === Storage ===
    uint8 public strategyId;
    address public agentExecutor;
    address public strategyRouter;
    address public activityLog;
    address public priceFeed;
    
    struct AssetAllocation {
        address token;
        uint16 targetBps;
    }
    AssetAllocation[] public targetAllocations;
    
    uint16 public rebalanceThresholdBps;
    uint16 public maxSlippageBps;
    uint256 public lastRebalanceTime;
    uint256 public minRebalanceInterval;
    
    bool public paused;
    
    uint256[39] private __gap;
    
    // === Events ===
    event Rebalanced(
        uint256 timestamp,
        address indexed agent,
        AssetAllocation[] oldAllocation,
        AssetAllocation[] newAllocation
    );
    event AgentExecutorUpdated(address indexed oldAgent, address indexed newAgent);
    event EmergencyPaused(address indexed by, string reason);
    event EmergencyUnpaused(address indexed by);
    
    // === Errors ===
    error NotAuthorizedAgent();
    error VaultPaused();
    error RebalanceTooSoon();
    error InvalidToken();
    
    modifier onlyAgent() {
        if (msg.sender != agentExecutor) revert NotAuthorizedAgent();
        _;
    }
    
    modifier whenNotPaused_() {
        if (paused) revert VaultPaused();
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function __BaseVault_init(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        uint8 _strategyId,
        address _owner,
        address _agentExecutor,
        address _strategyRouter,
        address _activityLog,
        address _priceFeed
    ) internal onlyInitializing {
        __ERC4626_init(_asset);
        __ERC20_init(_name, _symbol);
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        strategyId = _strategyId;
        agentExecutor = _agentExecutor;
        strategyRouter = _strategyRouter;
        activityLog = _activityLog;
        priceFeed = _priceFeed;
        
        rebalanceThresholdBps = 50;
        maxSlippageBps = 100;
        minRebalanceInterval = 1 hours;
    }
    
    /// @notice Total assets in USDC-equivalent (asset() decimals)
    function totalAssets() public view virtual override returns (uint256 total) {
        uint256 usdcDecimals = IERC20Metadata(asset()).decimals();
        uint256 usdcBalance = IERC20(asset()).balanceOf(address(this));
        
        // USDC normalized to 1e18 for math
        uint256 totalNormalized = usdcBalance * (10 ** (18 - usdcDecimals));
        
        for (uint i = 0; i < targetAllocations.length; i++) {
            address token = targetAllocations[i].token;
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;
            
            uint256 price = IPriceFeed(priceFeed).getPrice(token);
            uint256 tokenDecimals = IERC20Metadata(token).decimals();
            uint256 normalizedBalance = balance * (10 ** (18 - tokenDecimals));
            totalNormalized += (normalizedBalance * price) / 1e18;
        }
        
        // Back to USDC decimals
        total = totalNormalized / (10 ** (18 - usdcDecimals));
    }
    
    /// @notice Deposit with ERC-2612 permit
    function depositWithPermit(
        uint256 assets,
        address receiver,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares) {
        IERC20Permit(asset()).permit(msg.sender, address(this), assets, deadline, v, r, s);
        return deposit(assets, receiver);
    }
    
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        whenNotPaused_ 
        returns (uint256) 
    {
        return super.deposit(assets, receiver);
    }
    
    function mint(uint256 shares, address receiver) 
        public 
        override 
        whenNotPaused_ 
        returns (uint256) 
    {
        return super.mint(shares, receiver);
    }
    
    // Note: withdraw and redeem NOT paused — users can always exit
    
    function rebalance() external onlyAgent whenNotPaused_ nonReentrant {
        if (block.timestamp < lastRebalanceTime + minRebalanceInterval) {
            revert RebalanceTooSoon();
        }
        
        AssetAllocation[] memory oldAllocation = _captureCurrentAllocation();
        uint256 totalValue = totalAssets();
        
        for (uint i = 0; i < targetAllocations.length; i++) {
            _rebalanceAsset(targetAllocations[i], totalValue);
        }
        
        lastRebalanceTime = block.timestamp;
        
        emit Rebalanced(block.timestamp, msg.sender, oldAllocation, targetAllocations);
        
        IAgentActivityLog(activityLog).logActivity(
            strategyId,
            "REBALANCE",
            abi.encode(oldAllocation, targetAllocations)
        );
    }
    
    // Admin
    function setAgentExecutor(address newAgent) external onlyOwner {
        address oldAgent = agentExecutor;
        agentExecutor = newAgent;
        emit AgentExecutorUpdated(oldAgent, newAgent);
    }
    
    function emergencyPause(string calldata reason) external {
        require(msg.sender == owner() || msg.sender == agentExecutor, "Not authorized");
        paused = true;
        emit EmergencyPaused(msg.sender, reason);
    }
    
    function emergencyUnpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }
    
    // Internal
    function _captureCurrentAllocation() internal view returns (AssetAllocation[] memory result) {
        result = new AssetAllocation[](targetAllocations.length);
        for (uint i = 0; i < targetAllocations.length; i++) {
            result[i] = targetAllocations[i];
        }
    }
    
    function _rebalanceAsset(AssetAllocation memory target, uint256 totalValue) internal virtual;
    
    function _getCurrentValueOf(address token) internal view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) return 0;
        uint256 price = IPriceFeed(priceFeed).getPrice(token);
        uint256 tokenDecimals = IERC20Metadata(token).decimals();
        uint256 normalizedBalance = balance * (10 ** (18 - tokenDecimals));
        return (normalizedBalance * price) / 1e18;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### 3. LowVault.sol (Concrete UUPS)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseVault} from "./BaseVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategyRouter} from "../interfaces/IStrategyRouter.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

contract LowVault is BaseVault {
    function initialize(
        IERC20 _usdc,
        address _owner,
        address _agentExecutor,
        address _strategyRouter,
        address _activityLog,
        address _priceFeed,
        address _mUSD,
        address _USDY
    ) external initializer {
        __BaseVault_init(
            _usdc,
            "Tends Low Risk Vault",
            "tLOW",
            1,
            _owner,
            _agentExecutor,
            _strategyRouter,
            _activityLog,
            _priceFeed
        );
        
        targetAllocations.push(AssetAllocation({token: _mUSD, targetBps: 9000}));
        targetAllocations.push(AssetAllocation({token: _USDY, targetBps: 1000}));
    }
    
    function _rebalanceAsset(AssetAllocation memory target, uint256 totalValue) internal override {
        uint256 targetValue = (totalValue * target.targetBps) / 10000;
        uint256 currentValue = _getCurrentValueOf(target.token);
        
        if (targetValue > currentValue) {
            uint256 toBuyValue = targetValue - currentValue;
            _executeBuy(target.token, toBuyValue);
        } else if (currentValue > targetValue) {
            uint256 toSellValue = currentValue - targetValue;
            _executeSell(target.token, toSellValue);
        }
    }
    
    function _executeBuy(address token, uint256 amountUSDC) internal {
        IERC20 usdc = IERC20(asset());
        usdc.approve(strategyRouter, amountUSDC);
        
        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(
            address(usdc), token, amountUSDC
        );
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;
        
        IStrategyRouter(strategyRouter).executeSwap(
            address(usdc), token, amountUSDC, minReceived
        );
    }
    
    function _executeSell(address token, uint256 valueUSDC) internal {
        uint256 price = IPriceFeed(priceFeed).getPrice(token);
        uint256 amountToken = (valueUSDC * 1e18) / price;
        
        IERC20(token).approve(strategyRouter, amountToken);
        
        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(
            token, asset(), amountToken
        );
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;
        
        IStrategyRouter(strategyRouter).executeSwap(
            token, asset(), amountToken, minReceived
        );
    }
}
```

### 4. MediumVault.sol & HighVault.sol

Same pattern as LowVault. Different allocations:

**MediumVault** init:
```solidity
targetAllocations.push(AssetAllocation({token: _mUSD, targetBps: 4000}));
targetAllocations.push(AssetAllocation({token: _mETH, targetBps: 3000}));
targetAllocations.push(AssetAllocation({token: _cmETH, targetBps: 3000}));
```

**HighVault** init:
```solidity
targetAllocations.push(AssetAllocation({token: _cmETH, targetBps: 4000}));
targetAllocations.push(AssetAllocation({token: _sUSDe, targetBps: 3000}));
targetAllocations.push(AssetAllocation({token: _mETH, targetBps: 2000}));
targetAllocations.push(AssetAllocation({token: _wMNT, targetBps: 1000}));
```

Both share same `_rebalanceAsset`, `_executeBuy`, `_executeSell` logic as LowVault. Consider extracting to internal lib if duplication bothers you.

### 5. CompositeVault.sol (UUPS)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

contract CompositeVault is 
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // === Storage ===
    address public lowVault;
    address public mediumVault;
    address public highVault;
    
    struct UserConfig {
        uint16 lowBps;
        uint16 medBps;
        uint16 highBps;
        bool isSet;
    }
    
    mapping(address => UserConfig) public userConfigs;
    mapping(address => mapping(uint8 => uint256)) public userVaultShares;
    
    bool public paused;
    
    uint256[45] private __gap;
    
    event UserAllocationSet(address indexed user, uint16 lowBps, uint16 medBps, uint16 highBps);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);
    
    error AllocationNotSet();
    error InvalidAllocationSum();
    error VaultPaused();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        IERC20 _usdc,
        address _owner,
        address _lowVault,
        address _mediumVault,
        address _highVault
    ) external initializer {
        __ERC4626_init(_usdc);
        __ERC20_init("Tends Composite Vault", "tCOMP");
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        lowVault = _lowVault;
        mediumVault = _mediumVault;
        highVault = _highVault;
    }
    
    modifier whenNotPaused_() {
        if (paused) revert VaultPaused();
        _;
    }
    
    function setUserAllocation(uint16 lowBps, uint16 medBps, uint16 highBps) external {
        if (lowBps + medBps + highBps != 10000) revert InvalidAllocationSum();
        userConfigs[msg.sender] = UserConfig(lowBps, medBps, highBps, true);
        emit UserAllocationSet(msg.sender, lowBps, medBps, highBps);
    }
    
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        whenNotPaused_ 
        nonReentrant 
        returns (uint256 shares) 
    {
        UserConfig memory cfg = userConfigs[receiver];
        if (!cfg.isSet) revert AllocationNotSet();
        
        shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
        
        uint256 lowAmount = (assets * cfg.lowBps) / 10000;
        uint256 medAmount = (assets * cfg.medBps) / 10000;
        uint256 highAmount = assets - lowAmount - medAmount;
        
        IERC20 usdc = IERC20(asset());
        
        if (lowAmount > 0) {
            usdc.approve(lowVault, lowAmount);
            uint256 lowShares = IERC4626(lowVault).deposit(lowAmount, address(this));
            userVaultShares[receiver][1] += lowShares;
        }
        if (medAmount > 0) {
            usdc.approve(mediumVault, medAmount);
            uint256 medShares = IERC4626(mediumVault).deposit(medAmount, address(this));
            userVaultShares[receiver][2] += medShares;
        }
        if (highAmount > 0) {
            usdc.approve(highVault, highAmount);
            uint256 highShares = IERC4626(highVault).deposit(highAmount, address(this));
            userVaultShares[receiver][3] += highShares;
        }
    }
    
    function withdraw(uint256 assets, address receiver, address owner) 
        public 
        override 
        nonReentrant 
        returns (uint256 shares) 
    {
        UserConfig memory cfg = userConfigs[owner];
        
        uint256 lowAmount = (assets * cfg.lowBps) / 10000;
        uint256 medAmount = (assets * cfg.medBps) / 10000;
        uint256 highAmount = assets - lowAmount - medAmount;
        
        if (lowAmount > 0) {
            uint256 lowShares = IERC4626(lowVault).previewWithdraw(lowAmount);
            IERC4626(lowVault).withdraw(lowAmount, address(this), address(this));
            userVaultShares[owner][1] -= lowShares;
        }
        if (medAmount > 0) {
            uint256 medShares = IERC4626(mediumVault).previewWithdraw(medAmount);
            IERC4626(mediumVault).withdraw(medAmount, address(this), address(this));
            userVaultShares[owner][2] -= medShares;
        }
        if (highAmount > 0) {
            uint256 highShares = IERC4626(highVault).previewWithdraw(highAmount);
            IERC4626(highVault).withdraw(highAmount, address(this), address(this));
            userVaultShares[owner][3] -= highShares;
        }
        
        shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner, assets, shares);
    }
    
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this))
            + IERC4626(lowVault).convertToAssets(IERC4626(lowVault).balanceOf(address(this)))
            + IERC4626(mediumVault).convertToAssets(IERC4626(mediumVault).balanceOf(address(this)))
            + IERC4626(highVault).convertToAssets(IERC4626(highVault).balanceOf(address(this)));
    }
    
    function emergencyPause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender);
    }
    
    function emergencyUnpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### 6. StrategyRouter.sol (UUPS)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDexAdapter} from "../interfaces/IDexAdapter.sol";

contract StrategyRouter is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // === Storage ===
    address public dexAdapter;
    mapping(address => bool) public authorizedVaults;
    mapping(address => bool) public allowedTokens;
    
    uint256[47] private __gap;
    
    event SwapExecuted(address indexed vault, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event DexAdapterUpdated(address oldAdapter, address newAdapter);
    event VaultAuthorized(address indexed vault, bool authorized);
    event TokenAllowed(address indexed token, bool allowed);
    
    error UnauthorizedVault();
    error TokenNotAllowed();
    error InsufficientOutput();
    error InvalidAddress();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _owner, address _dexAdapter) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        dexAdapter = _dexAdapter;
    }
    
    modifier onlyAuthorizedVault() {
        if (!authorizedVaults[msg.sender]) revert UnauthorizedVault();
        _;
    }
    
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyAuthorizedVault returns (uint256 amountOut) {
        if (!allowedTokens[tokenIn] || !allowedTokens[tokenOut]) {
            revert TokenNotAllowed();
        }
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(dexAdapter, amountIn);
        
        amountOut = IDexAdapter(dexAdapter).swap(tokenIn, tokenOut, amountIn, minAmountOut, msg.sender);
        
        if (amountOut < minAmountOut) revert InsufficientOutput();
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
    
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn)
        external view returns (uint256)
    {
        return IDexAdapter(dexAdapter).quote(tokenIn, tokenOut, amountIn);
    }
    
    function setDexAdapter(address newAdapter) external onlyOwner {
        if (newAdapter == address(0)) revert InvalidAddress();
        address old = dexAdapter;
        dexAdapter = newAdapter;
        emit DexAdapterUpdated(old, newAdapter);
    }
    
    function authorizeVault(address vault, bool authorized) external onlyOwner {
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }
    
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### 7. AgentActivityLog.sol (UUPS)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AgentActivityLog is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // === Storage ===
    struct Activity {
        uint256 id;
        address agent;
        uint8 vaultId;
        string action;
        bytes metadata;
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    mapping(uint256 => Activity) public activities;
    uint256 public totalActivities;
    
    mapping(address => uint256[]) public activitiesByAgent;
    mapping(uint8 => uint256[]) public activitiesByVault;
    mapping(address => bool) public authorizedLoggers;
    
    uint256[45] private __gap;
    
    event ActivityLogged(uint256 indexed id, uint8 indexed vaultId, address indexed agent, string action, uint256 timestamp);
    event LoggerAuthorized(address logger, bool authorized);
    
    error NotAuthorized();
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
    }
    
    modifier onlyAuthorized() {
        if (!authorizedLoggers[msg.sender]) revert NotAuthorized();
        _;
    }
    
    function logActivity(uint8 vaultId, string calldata action, bytes calldata metadata) external onlyAuthorized {
        uint256 id = ++totalActivities;
        
        activities[id] = Activity({
            id: id,
            agent: tx.origin,
            vaultId: vaultId,
            action: action,
            metadata: metadata,
            timestamp: block.timestamp,
            blockNumber: block.number
        });
        
        activitiesByAgent[tx.origin].push(id);
        activitiesByVault[vaultId].push(id);
        
        emit ActivityLogged(id, vaultId, tx.origin, action, block.timestamp);
    }
    
    function getRecentActivities(uint256 count) external view returns (Activity[] memory result) {
        uint256 limit = count > totalActivities ? totalActivities : count;
        result = new Activity[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = activities[totalActivities - i];
        }
    }
    
    function getActivitiesByVault(uint8 vaultId, uint256 count) external view returns (Activity[] memory result) {
        uint256[] storage ids = activitiesByVault[vaultId];
        uint256 limit = count > ids.length ? ids.length : count;
        result = new Activity[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = activities[ids[ids.length - 1 - i]];
        }
    }
    
    function authorizeLogger(address logger, bool authorized) external onlyOwner {
        authorizedLoggers[logger] = authorized;
        emit LoggerAuthorized(logger, authorized);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### 8. MockDexAdapter.sol (Non-Upgradeable)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

/// @notice Mock DEX adapter for Mantle Sepolia testnet
/// @dev Uses PriceFeed for swap ratios, applies 0.3% mock slippage
contract MockDexAdapter is IDexAdapter {
    address public immutable priceFeed;
    uint256 public constant MOCK_SLIPPAGE_BPS = 30; // 0.3%
    
    constructor(address _priceFeed) {
        priceFeed = _priceFeed;
    }
    
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = _quote(tokenIn, tokenOut, amountIn);
        require(amountOut >= minAmountOut, "Slippage too high");
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(recipient, amountOut);
    }
    
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256) {
        return _quote(tokenIn, tokenOut, amountIn);
    }
    
    function _quote(address tokenIn, address tokenOut, uint256 amountIn) internal view returns (uint256) {
        uint256 priceIn = IPriceFeed(priceFeed).getPrice(tokenIn);
        uint256 priceOut = IPriceFeed(priceFeed).getPrice(tokenOut);
        
        uint8 decIn = IERC20Metadata(tokenIn).decimals();
        uint8 decOut = IERC20Metadata(tokenOut).decimals();
        
        uint256 amountInNormalized = amountIn * (10 ** (18 - decIn));
        uint256 valueIn = (amountInNormalized * priceIn) / 1e18;
        uint256 amountOutNormalized = (valueIn * 1e18) / priceOut;
        amountOutNormalized = (amountOutNormalized * (10000 - MOCK_SLIPPAGE_BPS)) / 10000;
        
        return amountOutNormalized / (10 ** (18 - decOut));
    }
}
```

### 9. Interfaces

```solidity
// src/interfaces/IPriceFeed.sol
pragma solidity ^0.8.24;
interface IPriceFeed {
    function getPrice(address token) external view returns (uint256);
    function getPriceUnsafe(address token) external view returns (uint256, uint256);
}

// src/interfaces/IStrategyRouter.sol
pragma solidity ^0.8.24;
interface IStrategyRouter {
    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}

// src/interfaces/IAgentActivityLog.sol
pragma solidity ^0.8.24;
interface IAgentActivityLog {
    function logActivity(uint8 vaultId, string calldata action, bytes calldata metadata) external;
}

// src/interfaces/IDexAdapter.sol
pragma solidity ^0.8.24;
interface IDexAdapter {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external returns (uint256);
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}
```

---

## Deployment Scripts

### Library Installation

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge install OpenZeppelin/openzeppelin-contracts-upgradeable@v5.0.2 --no-commit
forge install OpenZeppelin/openzeppelin-foundry-upgrades --no-commit
forge install foundry-rs/forge-std --no-commit
```

### script/DeployMocks.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockMUSD} from "../src/mocks/MockMUSD.sol";
import {MockUSDY} from "../src/mocks/MockUSDY.sol";
import {MockMETH} from "../src/mocks/MockMETH.sol";
import {MockCMETH} from "../src/mocks/MockCMETH.sol";
import {MockSUSDE} from "../src/mocks/MockSUSDE.sol";
import {MockWMNT} from "../src/mocks/MockWMNT.sol";

contract DeployMocksScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        
        MockUSDC usdc = new MockUSDC();
        MockMUSD musd = new MockMUSD();
        MockUSDY usdy = new MockUSDY();
        MockMETH meth = new MockMETH();
        MockCMETH cmeth = new MockCMETH();
        MockSUSDE susde = new MockSUSDE();
        MockWMNT wmnt = new MockWMNT();
        
        vm.stopBroadcast();
        
        console.log("=== Mock Tokens Deployed ===");
        console.log("USDC:  ", address(usdc));
        console.log("mUSD:  ", address(musd));
        console.log("USDY:  ", address(usdy));
        console.log("mETH:  ", address(meth));
        console.log("cmETH: ", address(cmeth));
        console.log("sUSDe: ", address(susde));
        console.log("WMNT:  ", address(wmnt));
        console.log("\nSave these addresses to .env!");
    }
}
```

### script/DeployCore.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";
import {PriceFeed} from "../src/pricing/PriceFeed.sol";
import {AgentActivityLog} from "../src/logs/AgentActivityLog.sol";
import {StrategyRouter} from "../src/routers/StrategyRouter.sol";
import {LowVault} from "../src/vaults/LowVault.sol";
import {MediumVault} from "../src/vaults/MediumVault.sol";
import {HighVault} from "../src/vaults/HighVault.sol";
import {CompositeVault} from "../src/vaults/CompositeVault.sol";
import {MockDexAdapter} from "../src/adapters/MockDexAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployCoreScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address agentExecutor = vm.envAddress("AGENT_EXECUTOR");
        address priceUpdater = vm.envAddress("PRICE_UPDATER");
        
        address usdc = vm.envAddress("USDC_ADDRESS");
        address mUSD = vm.envAddress("MUSD_ADDRESS");
        address USDY = vm.envAddress("USDY_ADDRESS");
        address mETH = vm.envAddress("METH_ADDRESS");
        address cmETH = vm.envAddress("CMETH_ADDRESS");
        address sUSDe = vm.envAddress("SUSDE_ADDRESS");
        address wMNT = vm.envAddress("WMNT_ADDRESS");
        
        vm.startBroadcast(deployerKey);
        
        // 1. PriceFeed (UUPS)
        address priceFeed = Upgrades.deployUUPSProxy(
            "PriceFeed.sol",
            abi.encodeCall(PriceFeed.initialize, (deployer, priceUpdater))
        );
        console.log("PriceFeed:", priceFeed);
        
        // 2. AgentActivityLog (UUPS)
        address activityLog = Upgrades.deployUUPSProxy(
            "AgentActivityLog.sol",
            abi.encodeCall(AgentActivityLog.initialize, (deployer))
        );
        console.log("AgentActivityLog:", activityLog);
        
        // 3. MockDexAdapter (non-upgradeable)
        MockDexAdapter dexAdapter = new MockDexAdapter(priceFeed);
        console.log("MockDexAdapter:", address(dexAdapter));
        
        // 4. StrategyRouter (UUPS)
        address router = Upgrades.deployUUPSProxy(
            "StrategyRouter.sol",
            abi.encodeCall(StrategyRouter.initialize, (deployer, address(dexAdapter)))
        );
        console.log("StrategyRouter:", router);
        
        // 5. LowVault (UUPS)
        address lowVault = Upgrades.deployUUPSProxy(
            "LowVault.sol",
            abi.encodeCall(
                LowVault.initialize,
                (IERC20(usdc), deployer, agentExecutor, router, activityLog, priceFeed, mUSD, USDY)
            )
        );
        console.log("LowVault:", lowVault);
        
        // 6. MediumVault (UUPS)
        address mediumVault = Upgrades.deployUUPSProxy(
            "MediumVault.sol",
            abi.encodeCall(
                MediumVault.initialize,
                (IERC20(usdc), deployer, agentExecutor, router, activityLog, priceFeed, mUSD, mETH, cmETH)
            )
        );
        console.log("MediumVault:", mediumVault);
        
        // 7. HighVault (UUPS)
        address highVault = Upgrades.deployUUPSProxy(
            "HighVault.sol",
            abi.encodeCall(
                HighVault.initialize,
                (IERC20(usdc), deployer, agentExecutor, router, activityLog, priceFeed, cmETH, sUSDe, mETH, wMNT)
            )
        );
        console.log("HighVault:", highVault);
        
        // 8. CompositeVault (UUPS)
        address composite = Upgrades.deployUUPSProxy(
            "CompositeVault.sol",
            abi.encodeCall(
                CompositeVault.initialize,
                (IERC20(usdc), deployer, lowVault, mediumVault, highVault)
            )
        );
        console.log("CompositeVault:", composite);
        
        vm.stopBroadcast();
        
        console.log("\n=== All UUPS proxies deployed ===");
        console.log("Run Configure.s.sol next to setup authorizations");
    }
}
```

### script/Configure.s.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {StrategyRouter} from "../src/routers/StrategyRouter.sol";
import {AgentActivityLog} from "../src/logs/AgentActivityLog.sol";

contract ConfigureScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        
        address router = vm.envAddress("ROUTER_ADDRESS");
        address activityLog = vm.envAddress("ACTIVITY_LOG_ADDRESS");
        address lowVault = vm.envAddress("LOW_VAULT_ADDRESS");
        address mediumVault = vm.envAddress("MEDIUM_VAULT_ADDRESS");
        address highVault = vm.envAddress("HIGH_VAULT_ADDRESS");
        address composite = vm.envAddress("COMPOSITE_VAULT_ADDRESS");
        address agentExecutor = vm.envAddress("AGENT_EXECUTOR");
        
        address usdc = vm.envAddress("USDC_ADDRESS");
        address mUSD = vm.envAddress("MUSD_ADDRESS");
        address USDY = vm.envAddress("USDY_ADDRESS");
        address mETH = vm.envAddress("METH_ADDRESS");
        address cmETH = vm.envAddress("CMETH_ADDRESS");
        address sUSDe = vm.envAddress("SUSDE_ADDRESS");
        address wMNT = vm.envAddress("WMNT_ADDRESS");
        
        vm.startBroadcast(deployerKey);
        
        // Authorize vaults in router
        StrategyRouter(router).authorizeVault(lowVault, true);
        StrategyRouter(router).authorizeVault(mediumVault, true);
        StrategyRouter(router).authorizeVault(highVault, true);
        StrategyRouter(router).authorizeVault(composite, true);
        
        // Allow tokens in router
        StrategyRouter(router).setAllowedToken(usdc, true);
        StrategyRouter(router).setAllowedToken(mUSD, true);
        StrategyRouter(router).setAllowedToken(USDY, true);
        StrategyRouter(router).setAllowedToken(mETH, true);
        StrategyRouter(router).setAllowedToken(cmETH, true);
        StrategyRouter(router).setAllowedToken(sUSDe, true);
        StrategyRouter(router).setAllowedToken(wMNT, true);
        
        // Authorize loggers
        AgentActivityLog(activityLog).authorizeLogger(lowVault, true);
        AgentActivityLog(activityLog).authorizeLogger(mediumVault, true);
        AgentActivityLog(activityLog).authorizeLogger(highVault, true);
        AgentActivityLog(activityLog).authorizeLogger(agentExecutor, true);
        
        vm.stopBroadcast();
    }
}
```

### script/UpgradeContract.s.sol (Template)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";

contract UpgradeContractScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_TO_UPGRADE");
        
        vm.startBroadcast(deployerKey);
        
        // Replace "LowVaultV2.sol" with new implementation contract
        Upgrades.upgradeProxy(
            proxyAddress,
            "LowVaultV2.sol",
            ""  // no re-init needed; pass abi.encodeCall(...) if needed
        );
        
        vm.stopBroadcast();
    }
}
```

---

## Deployment Commands

```bash
# 1. Setup env
cp .env.example .env
# Fill in PRIVATE_KEY, AGENT_EXECUTOR, PRICE_UPDATER, MANTLESCAN_KEY

# 2. Get test MNT from faucet
# Visit: https://faucet.sepolia.mantle.xyz

# 3. Build
forge build

# 4. Run tests
forge test -vvv

# 5. Deploy mock tokens
forge script script/DeployMocks.s.sol:DeployMocksScript \
  --rpc-url mantle_sepolia \
  --broadcast \
  --verify

# 6. Update .env with mock token addresses

# 7. Deploy core contracts
forge script script/DeployCore.s.sol:DeployCoreScript \
  --rpc-url mantle_sepolia \
  --broadcast \
  --verify

# 8. Update .env with proxy addresses

# 9. Configure
forge script script/Configure.s.sol:ConfigureScript \
  --rpc-url mantle_sepolia \
  --broadcast

# 10. Save deployment metadata
# Manually copy addresses to deployments/mantle-sepolia.json
```

---

## Mantle Sepolia Network Info

```
Network Name:    Mantle Sepolia
RPC URL:         https://rpc.sepolia.mantle.xyz
Chain ID:        5003
Currency:        MNT
Explorer:        https://explorer.sepolia.mantle.xyz
Faucet:          https://faucet.sepolia.mantle.xyz
```

---

## Test Strategy

### Required Tests

1. **PriceFeed**
   - BE can push prices, vault reads correctly
   - Stale prices revert reads
   - Non-updater cannot push prices
   - Owner can rotate updater
   - UUPS upgrade preserves state

2. **Deposit Flow**
   - User deposits USDC, receives shares
   - depositWithPermit works in 1 tx
   - Paused vault rejects deposits
   - First deposit gets 1:1 shares (when totalSupply=0)

3. **Withdraw Flow**
   - User withdraws partial/full
   - Composite withdraws pro-rata from base vaults
   - Withdrawal works even when paused (user safety)

4. **Rebalance Flow**
   - Agent triggers rebalance with realistic price changes
   - Allocations move toward target
   - Non-agent reverts
   - Too soon reverts (within minRebalanceInterval)
   - Activity logged in AgentActivityLog

5. **Custom Strategy Flow**
   - User sets 50/30/20 mix
   - Deposit 1000 USDC = 500 to Low, 300 to Med, 200 to High
   - Invalid sum (sum != 10000) reverts
   - Withdraw pro-rata from base vaults

6. **UUPS Upgrade Flow**
   - Deploy V1, deposit user funds
   - Upgrade to V2
   - User shares + balances preserved
   - New V2 features accessible

### Upgrade Test Pattern

```solidity
// test/integration/UpgradeFlow.t.sol
import {Test} from "forge-std/Test.sol";
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";
import {LowVault} from "../../src/vaults/LowVault.sol";

contract UpgradeFlowTest is Test {
    function test_UUPSUpgrade_PreservesState() public {
        // Deploy V1, deposit user funds
        // Capture state (balanceOf, totalAssets, etc.)
        // Call Upgrades.upgradeProxy(...)
        // Verify state preserved
    }
}
```

---

## Env Variables

```bash
# .env
PRIVATE_KEY=0x...                      # Deployer key
AGENT_EXECUTOR=0x...                   # Backend agent wallet
PRICE_UPDATER=0x...                    # Backend price pusher wallet
MANTLESCAN_KEY=...                     # Etherscan-compatible API key

# Populated after DeployMocks
USDC_ADDRESS=
MUSD_ADDRESS=
USDY_ADDRESS=
METH_ADDRESS=
CMETH_ADDRESS=
SUSDE_ADDRESS=
WMNT_ADDRESS=

# Populated after DeployCore
PRICE_FEED_ADDRESS=
ACTIVITY_LOG_ADDRESS=
DEX_ADAPTER_ADDRESS=
ROUTER_ADDRESS=
LOW_VAULT_ADDRESS=
MEDIUM_VAULT_ADDRESS=
HIGH_VAULT_ADDRESS=
COMPOSITE_VAULT_ADDRESS=
```

---

## Phase Plan (Gate-Driven)

### Phase 1: Foundation
**Gate**: Mock tokens deployed, PriceFeed UUPS works

1. `forge init`, install all libs (OpenZeppelin contracts + upgradeable + foundry-upgrades + forge-std)
2. Setup remappings.txt, foundry.toml
3. Implement all 7 mock tokens with **real names/symbols**
4. Implement `PriceFeed.sol` (UUPS)
5. Write unit tests for PriceFeed
6. Deploy mocks + PriceFeed to Mantle Sepolia
7. Manual test: BE-style price push via `cast send`

### Phase 2: LowVault MVP
**Gate**: User can deposit USDC, get shares, withdraw back

1. Implement `IDexAdapter`, `MockDexAdapter`
2. Implement `BaseVault` (abstract UUPS)
3. Implement `LowVault` (concrete UUPS)
4. Implement `AgentActivityLog` (UUPS)
5. Implement `StrategyRouter` (UUPS)
6. Deploy all + run Configure script
7. Manual test: deposit 1000 USDC → verify shares → withdraw → verify USDC back

### Phase 3: All Tiers + Composite
**Gate**: Custom strategy works end-to-end

1. Implement `MediumVault`, `HighVault`
2. Implement `CompositeVault`
3. Write tests for custom allocation flow
4. Deploy + configure
5. Test 50/30/20 mix end-to-end

### Phase 4: Agent Integration
**Gate**: Agent rebalance works, activity logged

1. Mock agent EOA triggers rebalance
2. Verify allocations move toward target
3. Verify AgentActivityLog records entries
4. Test min rebalance interval enforcement

### Phase 5: Upgrade Testing
**Gate**: Can upgrade V1 → V2 without state loss

1. Deploy V1 with user funds
2. Create V2 with extra feature
3. Test upgrade preserves all user state via `Upgrades.upgradeProxy`

### Phase 6: Backend Handoff
**Gate**: BE can push prices, trigger rebalance via TypeScript

1. Document all contract addresses in `deployments/mantle-sepolia.json`
2. Export ABI to `out/` (handled by Foundry)
3. Hand off to backend dev for indexer/agent integration

---

## Critical Decisions Already Made

1. **UUPS upgradeable**: All core contracts. Mocks stay simple ERC-20.
2. **Mantle Sepolia only**: Hackathon scope. Mainnet = post-hackathon.
3. **Mock tokens use real names/symbols**: `mETH`, `USDY`, etc.
4. **PriceFeed, NOT oracle**: BE pushes prices. Centralization acknowledged.
5. **ERC-4626 standard**: All vaults.
6. **ERC-2612 permit for deposit**: 1 sign user experience.
7. **Agent has internal swap authority only**: Cannot withdraw to external addresses.
8. **Composite holds shares of base vaults**: Cleaner than per-user tracking.
9. **Single DEX adapter for hackathon**: MockDexAdapter only.
10. **Rebalance interval: 1 hour min**: Prevent excessive activity.

---

## Things NOT to Do

1. **Do NOT** add constructor logic to UUPS contracts — use `initialize()`
2. **Do NOT** forget `_disableInitializers()` in implementation constructor
3. **Do NOT** change storage variable order between versions
4. **Do NOT** forget storage gaps (`__gap`) in inherited contracts
5. **Do NOT** mix `@openzeppelin/contracts` and `@openzeppelin/contracts-upgradeable` in same upgradeable contract
6. **Do NOT** put user-private data in AgentActivityLog metadata (public)
7. **Do NOT** let agent execute swaps to non-whitelisted tokens
8. **Do NOT** skip `nonReentrant` modifier on state-changing functions
9. **Do NOT** trust off-chain APY data on-chain (use PriceFeed only)
10. **Do NOT** use `tx.origin` for authentication (only for log identification)
11. **Do NOT** pause withdrawals (user safety — always can exit)

---

## Common Issues & Solutions

### Issue: "Initializable: contract is already initialized"
Solution: Implementation contract constructor must call `_disableInitializers()`. Only proxy goes through initialize.

### Issue: "ERC1967: new implementation is not UUPS"
Solution: New version must inherit `UUPSUpgradeable` and implement `_authorizeUpgrade()`.

### Issue: "OZ Upgrades: storage layout incompatible"
Solution: Don't reorder existing state variables. Append new ones AT THE END. Reduce `__gap` accordingly.

### Issue: PriceFeed reverts "StalePrice"
Solution: BE must push prices within `maxStaleness` window (1 hour default). For dev/test, owner can call `setMaxStaleness(type(uint256).max)`.

### Issue: "ERC4626: deposit more than max"
Solution: Vault is paused. Check vault state via `paused()`.

### Issue: Foundry can't find Upgrades plugin
Solution: Check `ffi = true` and `ast = true` in foundry.toml. Verify install: `forge install OpenZeppelin/openzeppelin-foundry-upgrades`.

### Issue: "Cannot find PriceFeed.sol"
Solution: Upgrades plugin reads contract by filename. Ensure file is named exactly the contract name + `.sol`.

### Issue: Decimals mismatch in totalAssets
Solution: USDC is 6 decimals, others 18. Always normalize before doing price math, denormalize before return.

---

## When Stuck

If hit a blocker, return to user with:
1. What you tried
2. Specific error message
3. 2-3 possible solutions you considered
4. Recommended next step

Don't burn cycles on uncertain paths. Ask early.

---

## References

- ERC-4626 Standard: https://eips.ethereum.org/EIPS/eip-4626
- ERC-2612 Permit: https://eips.ethereum.org/EIPS/eip-2612
- ERC-1967 Proxy: https://eips.ethereum.org/EIPS/eip-1967
- OpenZeppelin Upgradeable: https://docs.openzeppelin.com/contracts/5.x/upgradeable
- OZ Foundry Upgrades: https://docs.openzeppelin.com/upgrades-plugins/1.x/foundry-upgrades
- UUPS vs Transparent: https://docs.openzeppelin.com/contracts/5.x/api/proxy#UUPSUpgradeable
- Foundry Book: https://book.getfoundry.sh/
- Mantle Docs: https://docs.mantle.xyz/network/system-information/network-details
- Mantle Sepolia Faucet: https://faucet.sepolia.mantle.xyz

---

## Final Note

Build incrementally. Test each contract before moving to next. PriceFeed first (foundation for everything), then LowVault (validates pattern), then expand.

Velocity > perfection. Ship working code first, optimize later.

Don't forget: this is UUPS — every core contract needs `initialize()`, `_disableInitializers()` in constructor, and `_authorizeUpgrade()`. No constructors with logic. Storage gaps mandatory.
