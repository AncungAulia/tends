# Smart Contract Specification
## Target: Mantle Sepolia → Mantle Mainnet
## Framework: Foundry + OpenZeppelin

---

## Contract Overview

```
BaseVault (abstract, ERC-4626)
  ├─> LowVault     (mUSD 90% + USDY 10%)
  ├─> MediumVault  (mUSD 40% + mETH 30% + cmETH 30%)
  └─> HighVault    (cmETH 40% + sUSDe 30% + mETH 20% + MNT 10%)

CompositeVault (ERC-4626, holds shares of L/M/H)
StrategyRouter (swap engine, DEX abstraction)
AgentActivityLog (event log untuk verifiability)
OracleManager (price abstraction)
```

---

## 1. BaseVault.sol (Abstract)

Base contract untuk tier vaults. Inherit dari OpenZeppelin ERC4626.

### State

```solidity
abstract contract BaseVault is ERC4626, Ownable, ReentrancyGuard {
    // Strategy identification
    uint8 public immutable strategyId; // 1=LOW, 2=MED, 3=HIGH
    
    // Agent authority
    address public agentExecutor;
    
    // Strategy router
    address public strategyRouter;
    
    // Allocation config (basis points, 10000 = 100%)
    struct AssetAllocation {
        address token;
        uint16 targetBps;
    }
    AssetAllocation[] public targetAllocations;
    
    // Rebalance threshold
    uint16 public rebalanceThresholdBps = 50; // 0.5% drift triggers
    uint256 public lastRebalanceTime;
    
    // Emergency pause
    bool public paused;
    
    // Activity log
    address public activityLog;
    
    // Oracle
    address public oracle;
    
    // Token balances tracked
    mapping(address => uint256) public assetBalances;
}
```

### Events

```solidity
event Rebalanced(
    uint256 timestamp,
    address indexed agent,
    AssetAllocation[] oldAllocation,
    AssetAllocation[] newAllocation,
    bytes32[] txHashes
);

event AgentExecutorUpdated(address indexed oldAgent, address indexed newAgent);

event StrategyConfigUpdated(AssetAllocation[] newAllocations);

event EmergencyPaused(address indexed by, string reason);
```

### Modifiers

```solidity
modifier onlyAgent() {
    require(msg.sender == agentExecutor, "Not authorized agent");
    _;
}

modifier whenNotPaused() {
    require(!paused, "Vault paused");
    _;
}
```

### Core Functions (inherited from ERC4626)

```solidity
// Standard ERC-4626 functions:
function deposit(uint256 assets, address receiver) external whenNotPaused returns (uint256 shares);
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
function mint(uint256 shares, address receiver) external whenNotPaused returns (uint256 assets);
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
function totalAssets() public view override returns (uint256);
```

### Custom Functions

```solidity
/**
 * @notice Override totalAssets to compute USDC equivalent of all positions
 */
function totalAssets() public view override returns (uint256) {
    uint256 total = IERC20(asset()).balanceOf(address(this)); // unallocated USDC
    
    for (uint i = 0; i < targetAllocations.length; i++) {
        address token = targetAllocations[i].token;
        uint256 balance = assetBalances[token];
        if (balance > 0) {
            uint256 price = IOracleManager(oracle).getPrice(token);
            total += (balance * price) / 1e18;
        }
    }
    
    return total;
}

/**
 * @notice Trigger rebalance to target allocations
 * @dev Called by agent executor
 */
function rebalance() external onlyAgent whenNotPaused {
    AssetAllocation[] memory oldAllocation = _captureCurrentAllocation();
    
    uint256 totalValue = totalAssets();
    bytes32[] memory txHashes = new bytes32[](targetAllocations.length);
    
    for (uint i = 0; i < targetAllocations.length; i++) {
        AssetAllocation memory target = targetAllocations[i];
        uint256 targetValue = (totalValue * target.targetBps) / 10000;
        uint256 currentValue = _getCurrentValueOf(target.token);
        
        if (targetValue > currentValue) {
            // Need to buy more
            uint256 toBuy = targetValue - currentValue;
            txHashes[i] = _executeBuy(target.token, toBuy);
        } else if (currentValue > targetValue) {
            // Need to sell
            uint256 toSell = currentValue - targetValue;
            txHashes[i] = _executeSell(target.token, toSell);
        }
    }
    
    lastRebalanceTime = block.timestamp;
    
    emit Rebalanced(block.timestamp, msg.sender, oldAllocation, targetAllocations, txHashes);
    
    // Log to activity log
    IAgentActivityLog(activityLog).logActivity(
        strategyId,
        "REBALANCE",
        abi.encode(oldAllocation, targetAllocations)
    );
}

/**
 * @notice Deposit with ERC-2612 permit (combined approve + deposit in 1 sign)
 */
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

/**
 * @notice Update agent executor (only owner)
 */
function setAgentExecutor(address newAgent) external onlyOwner {
    address oldAgent = agentExecutor;
    agentExecutor = newAgent;
    emit AgentExecutorUpdated(oldAgent, newAgent);
}

/**
 * @notice Emergency pause (only owner or agent)
 */
function emergencyPause(string calldata reason) external {
    require(msg.sender == owner() || msg.sender == agentExecutor, "Not authorized");
    paused = true;
    emit EmergencyPaused(msg.sender, reason);
}

/**
 * @notice Internal: execute buy via strategy router
 */
function _executeBuy(address token, uint256 amountUSDC) internal returns (bytes32) {
    // Approve router
    IERC20(asset()).approve(strategyRouter, amountUSDC);
    
    // Execute swap
    uint256 received = IStrategyRouter(strategyRouter).executeSwap(
        asset(),
        token,
        amountUSDC,
        _calculateMinReceived(token, amountUSDC)
    );
    
    assetBalances[token] += received;
    
    return blockhash(block.number - 1); // simplification
}

/**
 * @notice Internal: execute sell via strategy router
 */
function _executeSell(address token, uint256 valueUSDC) internal returns (bytes32) {
    uint256 price = IOracleManager(oracle).getPrice(token);
    uint256 amountToken = (valueUSDC * 1e18) / price;
    
    IERC20(token).approve(strategyRouter, amountToken);
    
    uint256 received = IStrategyRouter(strategyRouter).executeSwap(
        token,
        asset(),
        amountToken,
        _calculateMinReceived(asset(), amountToken)
    );
    
    assetBalances[token] -= amountToken;
    
    return blockhash(block.number - 1);
}

/**
 * @notice Internal: calculate min received with slippage tolerance
 */
function _calculateMinReceived(address tokenOut, uint256 valueIn) internal view returns (uint256) {
    uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(asset(), tokenOut, valueIn);
    return (expected * 9950) / 10000; // 0.5% slippage tolerance
}
```

### Errors

```solidity
error NotAuthorizedAgent();
error VaultPaused();
error InsufficientLiquidity();
error AllocationExceedsMax();
error InvalidStrategyId();
```

---

## 2. LowVault.sol

```solidity
contract LowVault is BaseVault {
    constructor(
        IERC20 _usdc,
        address _strategyRouter,
        address _agentExecutor,
        address _activityLog,
        address _oracle
    ) ERC4626(_usdc) ERC20("Low Risk Vault", "vLOW") {
        strategyId = 1;
        strategyRouter = _strategyRouter;
        agentExecutor = _agentExecutor;
        activityLog = _activityLog;
        oracle = _oracle;
        
        // Set initial allocation: 90% mUSD + 10% USDY
        targetAllocations.push(AssetAllocation({
            token: MANTLE_MUSD,
            targetBps: 9000
        }));
        targetAllocations.push(AssetAllocation({
            token: ONDO_USDY,
            targetBps: 1000
        }));
    }
}
```

## 3. MediumVault.sol

```solidity
contract MediumVault is BaseVault {
    constructor(...) ERC4626(_usdc) ERC20("Medium Risk Vault", "vMED") {
        strategyId = 2;
        // ... base setup ...
        
        // 40% mUSD + 30% mETH + 30% cmETH
        targetAllocations.push(AssetAllocation({token: MANTLE_MUSD, targetBps: 4000}));
        targetAllocations.push(AssetAllocation({token: MANTLE_METH, targetBps: 3000}));
        targetAllocations.push(AssetAllocation({token: MANTLE_CMETH, targetBps: 3000}));
    }
}
```

## 4. HighVault.sol

```solidity
contract HighVault is BaseVault {
    constructor(...) ERC4626(_usdc) ERC20("High Risk Vault", "vHIGH") {
        strategyId = 3;
        // ... base setup ...
        
        // 40% cmETH + 30% sUSDe + 20% mETH + 10% MNT
        targetAllocations.push(AssetAllocation({token: MANTLE_CMETH, targetBps: 4000}));
        targetAllocations.push(AssetAllocation({token: ETHENA_SUSDE, targetBps: 3000}));
        targetAllocations.push(AssetAllocation({token: MANTLE_METH, targetBps: 2000}));
        targetAllocations.push(AssetAllocation({token: WMNT, targetBps: 1000}));
    }
}
```

---

## 5. CompositeVault.sol

**Key innovation**: User custom strategy stored per-deposit. Composite holds shares of base vaults.

### State

```solidity
contract CompositeVault is ERC4626, Ownable {
    LowVault public immutable lowVault;
    MediumVault public immutable mediumVault;
    HighVault public immutable highVault;
    
    // Per-user custom allocation
    struct UserConfig {
        uint16 lowBps;   // 0-10000
        uint16 medBps;
        uint16 highBps;
        bool isSet;
    }
    mapping(address => UserConfig) public userConfigs;
    
    // Aggregated shares per user across base vaults
    mapping(address => mapping(uint8 => uint256)) public userVaultShares;
}
```

### Functions

```solidity
/**
 * @notice Set user custom allocation before deposit
 */
function setUserAllocation(uint16 lowBps, uint16 medBps, uint16 highBps) external {
    require(lowBps + medBps + highBps == 10000, "Must sum to 100%");
    userConfigs[msg.sender] = UserConfig(lowBps, medBps, highBps, true);
}

/**
 * @notice Deposit USDC, auto-distribute to base vaults per user config
 */
function deposit(uint256 assets, address receiver) public override returns (uint256 shares) {
    UserConfig memory cfg = userConfigs[receiver];
    require(cfg.isSet, "Set allocation first");
    
    // Mint composite shares
    shares = previewDeposit(assets);
    _deposit(_msgSender(), receiver, assets, shares);
    
    // Distribute USDC across base vaults
    uint256 lowAmount = (assets * cfg.lowBps) / 10000;
    uint256 medAmount = (assets * cfg.medBps) / 10000;
    uint256 highAmount = assets - lowAmount - medAmount;
    
    if (lowAmount > 0) {
        IERC20(asset()).approve(address(lowVault), lowAmount);
        uint256 lowShares = lowVault.deposit(lowAmount, address(this));
        userVaultShares[receiver][1] += lowShares;
    }
    if (medAmount > 0) {
        IERC20(asset()).approve(address(mediumVault), medAmount);
        uint256 medShares = mediumVault.deposit(medAmount, address(this));
        userVaultShares[receiver][2] += medShares;
    }
    if (highAmount > 0) {
        IERC20(asset()).approve(address(highVault), highAmount);
        uint256 highShares = highVault.deposit(highAmount, address(this));
        userVaultShares[receiver][3] += highShares;
    }
    
    return shares;
}

/**
 * @notice Withdraw USDC pro-rata from base vaults
 */
function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares) {
    UserConfig memory cfg = userConfigs[owner];
    
    // Calculate proportional withdrawal from each base vault
    uint256 lowAmount = (assets * cfg.lowBps) / 10000;
    uint256 medAmount = (assets * cfg.medBps) / 10000;
    uint256 highAmount = assets - lowAmount - medAmount;
    
    if (lowAmount > 0) {
        uint256 lowShares = lowVault.previewWithdraw(lowAmount);
        lowVault.withdraw(lowAmount, address(this), address(this));
        userVaultShares[owner][1] -= lowShares;
    }
    if (medAmount > 0) {
        uint256 medShares = mediumVault.previewWithdraw(medAmount);
        mediumVault.withdraw(medAmount, address(this), address(this));
        userVaultShares[owner][2] -= medShares;
    }
    if (highAmount > 0) {
        uint256 highShares = highVault.previewWithdraw(highAmount);
        highVault.withdraw(highAmount, address(this), address(this));
        userVaultShares[owner][3] -= highShares;
    }
    
    // Burn composite shares
    shares = previewWithdraw(assets);
    _withdraw(_msgSender(), receiver, owner, assets, shares);
    
    return shares;
}

/**
 * @notice Total value held by composite (sum across base vaults)
 */
function totalAssets() public view override returns (uint256) {
    return IERC20(asset()).balanceOf(address(this))
        + lowVault.convertToAssets(lowVault.balanceOf(address(this)))
        + mediumVault.convertToAssets(mediumVault.balanceOf(address(this)))
        + highVault.convertToAssets(highVault.balanceOf(address(this)));
}
```

---

## 6. StrategyRouter.sol

### State

```solidity
contract StrategyRouter is Ownable {
    // DEX adapters
    mapping(uint8 => address) public dexes;
    enum DexId { MERCHANT_MOE, AGNI, FUSION_X }
    
    // Whitelist
    mapping(address => bool) public allowedTokens;
    mapping(address => bool) public authorizedVaults;
    
    // Oracle
    address public oracle;
}
```

### Functions

```solidity
/**
 * @notice Execute swap, called by authorized vault
 */
function executeSwap(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external returns (uint256 amountOut) {
    require(authorizedVaults[msg.sender], "Unauthorized vault");
    require(allowedTokens[tokenIn] && allowedTokens[tokenOut], "Token not allowed");
    
    // Find best DEX
    (uint8 bestDex, uint256 expectedOut) = _findBestDex(tokenIn, tokenOut, amountIn);
    require(expectedOut >= minAmountOut, "Insufficient output");
    
    // Transfer in
    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    
    // Execute via best DEX
    if (bestDex == uint8(DexId.MERCHANT_MOE)) {
        amountOut = _swapMerchantMoe(tokenIn, tokenOut, amountIn);
    } else if (bestDex == uint8(DexId.AGNI)) {
        amountOut = _swapAgni(tokenIn, tokenOut, amountIn);
    } else {
        amountOut = _swapFusionX(tokenIn, tokenOut, amountIn);
    }
    
    // Transfer out
    IERC20(tokenOut).transfer(msg.sender, amountOut);
    
    emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, bestDex);
}

/**
 * @notice Find DEX dengan harga terbaik
 */
function _findBestDex(address tokenIn, address tokenOut, uint256 amountIn) 
    internal view returns (uint8 dexId, uint256 expectedOut) 
{
    // Query each DEX, return best
}

function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) 
    external view returns (uint256) 
{
    (, uint256 expected) = _findBestDex(tokenIn, tokenOut, amountIn);
    return expected;
}
```

---

## 7. AgentActivityLog.sol

```solidity
contract AgentActivityLog {
    struct Activity {
        uint256 id;
        address agent;
        uint8 vaultId;        // 1=Low, 2=Med, 3=High, 4=Composite
        string action;        // "REBALANCE", "DEPOSIT", "WITHDRAW", "PAUSE"
        bytes metadata;       // encoded action-specific data
        uint256 timestamp;
        uint256 blockNumber;
    }
    
    mapping(uint256 => Activity) public activities;
    uint256 public totalActivities;
    
    mapping(address => uint256[]) public agentActivities;
    mapping(uint8 => uint256[]) public vaultActivities;
    
    mapping(address => bool) public authorizedLoggers;
    
    event ActivityLogged(
        uint256 indexed id,
        uint8 indexed vaultId,
        address indexed agent,
        string action,
        uint256 timestamp
    );
    
    modifier onlyAuthorized() {
        require(authorizedLoggers[msg.sender], "Not authorized");
        _;
    }
    
    function logActivity(
        uint8 vaultId,
        string calldata action,
        bytes calldata metadata
    ) external onlyAuthorized {
        uint256 id = ++totalActivities;
        
        activities[id] = Activity({
            id: id,
            agent: tx.origin, // capture agent EOA
            vaultId: vaultId,
            action: action,
            metadata: metadata,
            timestamp: block.timestamp,
            blockNumber: block.number
        });
        
        agentActivities[tx.origin].push(id);
        vaultActivities[vaultId].push(id);
        
        emit ActivityLogged(id, vaultId, tx.origin, action, block.timestamp);
    }
    
    function getRecentActivities(uint256 count) external view returns (Activity[] memory) {
        uint256 start = totalActivities >= count ? totalActivities - count + 1 : 1;
        Activity[] memory recent = new Activity[](totalActivities - start + 1);
        
        for (uint256 i = start; i <= totalActivities; i++) {
            recent[i - start] = activities[i];
        }
        return recent;
    }
}
```

---

## 8. OracleManager.sol

Abstraction layer untuk swap oracle implementation.

```solidity
contract OracleManager is Ownable {
    enum OracleType { PYTH, CHAINLINK, MOCK }
    
    struct OracleConfig {
        OracleType primaryType;
        OracleType fallbackType;
        bytes32 pythFeedId;
        address chainlinkFeed;
        uint256 mockPrice; // for testnet
        uint256 maxStaleness; // seconds
    }
    
    mapping(address => OracleConfig) public oracleConfigs;
    
    address public pythContract;
    
    function getPrice(address asset) external view returns (uint256) {
        OracleConfig memory cfg = oracleConfigs[asset];
        
        if (cfg.primaryType == OracleType.MOCK) {
            return cfg.mockPrice;
        }
        
        if (cfg.primaryType == OracleType.PYTH) {
            try IPyth(pythContract).getPriceUnsafe(cfg.pythFeedId) returns (PythStructs.Price memory p) {
                if (block.timestamp - p.publishTime <= cfg.maxStaleness) {
                    return _normalizePythPrice(p);
                }
            } catch {}
            
            // Fallback
            return _readFallback(cfg);
        }
        
        if (cfg.primaryType == OracleType.CHAINLINK) {
            return _readChainlink(cfg.chainlinkFeed);
        }
        
        revert("No oracle available");
    }
    
    function setConfig(address asset, OracleConfig calldata config) external onlyOwner {
        oracleConfigs[asset] = config;
    }
    
    function _readChainlink(address feed) internal view returns (uint256) {
        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price) * 1e10; // normalize to 18 decimals
    }
    
    function _normalizePythPrice(PythStructs.Price memory p) internal pure returns (uint256) {
        // Pyth uses negative exponent typically
        if (p.expo < 0) {
            return uint256(uint64(p.price)) * 1e18 / (10 ** uint32(-p.expo));
        }
        return uint256(uint64(p.price)) * 1e18 * (10 ** uint32(p.expo));
    }
}
```

---

## 9. Test Suite (Foundry)

```
test/
├── BaseVault.t.sol
├── LowVault.t.sol
├── CompositeVault.t.sol
├── StrategyRouter.t.sol
├── AgentActivityLog.t.sol
└── Integration/
    ├── DepositWithdraw.t.sol
    ├── RebalanceFlow.t.sol
    ├── CustomStrategyFlow.t.sol
    └── EndToEnd.t.sol
```

### Key Test Scenarios

```solidity
// Test 1: User deposit dengan permit, get shares
function testDepositWithPermit() public {
    // Setup permit signature
    // User calls depositWithPermit
    // Assert shares minted correctly
    // Assert vault balance updated
}

// Test 2: Agent rebalance updates allocation
function testAgentRebalance() public {
    // Setup vault with off-target allocation
    // Mock agent calls rebalance()
    // Assert allocations move toward target
    // Assert AgentActivityLog updated
}

// Test 3: Composite vault distributes to base vaults
function testCompositeDeposit() public {
    // User sets custom allocation 50/30/20
    // User deposits 1000 USDC
    // Assert: lowVault has 500, medVault has 300, highVault has 200
    // Assert: composite shares minted correctly
}

// Test 4: Withdraw pro-rata from composite
function testCompositeWithdraw() public {
    // After setup from test 3
    // User withdraws 100 USDC
    // Assert: 50 from low, 30 from med, 20 from high
    // Assert: composite shares burned correctly
}

// Test 5: Unauthorized agent cannot rebalance
function testUnauthorizedRebalance() public {
    vm.expectRevert("Not authorized agent");
    vault.rebalance();
}

// Test 6: Emergency pause stops deposits
function testEmergencyPause() public {
    vault.emergencyPause("test");
    vm.expectRevert("Vault paused");
    vault.deposit(100, user);
}
```

---

## 10. Deployment Scripts

### `script/Deploy.s.sol`

```solidity
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        
        // 1. Deploy Oracle Manager
        OracleManager oracle = new OracleManager();
        
        // 2. Setup oracle configs (mock for testnet)
        oracle.setConfig(MANTLE_MUSD, OracleConfig({
            primaryType: OracleType.MOCK,
            mockPrice: 1e18, // $1
            // ... other fields
        }));
        // ... other assets
        
        // 3. Deploy Activity Log
        AgentActivityLog log = new AgentActivityLog();
        
        // 4. Deploy Strategy Router
        StrategyRouter router = new StrategyRouter(address(oracle));
        
        // 5. Deploy tier vaults
        LowVault low = new LowVault(USDC, address(router), AGENT_ADDR, address(log), address(oracle));
        MediumVault med = new MediumVault(USDC, address(router), AGENT_ADDR, address(log), address(oracle));
        HighVault high = new HighVault(USDC, address(router), AGENT_ADDR, address(log), address(oracle));
        
        // 6. Deploy Composite Vault
        CompositeVault composite = new CompositeVault(
            USDC, address(low), address(med), address(high)
        );
        
        // 7. Setup permissions
        router.authorizeVault(address(low));
        router.authorizeVault(address(med));
        router.authorizeVault(address(high));
        
        log.authorizeLogger(address(low));
        log.authorizeLogger(address(med));
        log.authorizeLogger(address(high));
        log.authorizeLogger(AGENT_ADDR);
        
        vm.stopBroadcast();
        
        // Print addresses
        console.log("Oracle:    ", address(oracle));
        console.log("Log:       ", address(log));
        console.log("Router:    ", address(router));
        console.log("Low:       ", address(low));
        console.log("Med:       ", address(med));
        console.log("High:      ", address(high));
        console.log("Composite: ", address(composite));
    }
}
```

---

## 11. Contract Addresses (Constants)

### Mantle Mainnet
```solidity
address constant MANTLE_USDC      = 0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9;
address constant MANTLE_MUSD      = 0xF6f4a30EEf7cf51Ed4Ee1415fB3bFDAf3694B0d2; // verify
address constant MANTLE_METH      = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;
address constant MANTLE_CMETH     = 0xE6829d9a7eE3040e1276Fa75293Bde931859e8fA;
address constant ETHENA_USDE      = 0x...; // bridged via LayerZero
address constant ETHENA_SUSDE     = 0x...;
address constant ONDO_USDY        = 0x...;
address constant WMNT             = 0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8;

// Oracles
address constant PYTH_CONTRACT_MAINNET = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;
```

### Mantle Sepolia (Testnet)
```solidity
address constant PYTH_CONTRACT_SEPOLIA = 0x98046Bd286715D3B0BC227Dd7a956b83D8978603;
// Other addresses: deploy MockERC20 untuk simulate USDY, mETH, etc.
```

**Important verifies:**
1. mUSD contract address di Mantle (cek Mantle docs)
2. USDY bridged Mantle contract
3. sUSDe + USDe Mantle bridged addresses

---

## 12. Deliverable Checklist

### Phase 1 Done When:
- [ ] BaseVault deployed dan tested
- [ ] LowVault deployed di Sepolia
- [ ] Deposit + Withdraw test pass
- [ ] User can deposit USDC, get vault shares
- [ ] User can withdraw, get USDC back

### Phase 2 Done When:
- [ ] MediumVault + HighVault deployed
- [ ] CompositeVault deployed
- [ ] Custom allocation setUserAllocation works
- [ ] Composite distributes correctly
- [ ] Composite withdraws pro-rata correctly

### Phase 3 Done When:
- [ ] StrategyRouter integrates Merchant Moe (atau mock)
- [ ] Rebalance function callable by agent
- [ ] AgentActivityLog records all agent actions
- [ ] All test scenarios pass

### Phase 5 (Mainnet) Done When:
- [ ] All contracts deployed Mantle Mainnet
- [ ] Verified on Mantle Explorer
- [ ] Initial deposit + rebalance executed
- [ ] Agent wallet funded + authorized

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Real RWA tokens not bridged to Sepolia | Use MockERC20 contracts with realistic behavior |
| DEX liquidity on testnet | Deploy mock DEX router OR use Merchant Moe testnet pool |
| Agent EOA compromise | Limit agent functions to internal swaps only, cannot transfer to external addresses |
| Oracle manipulation | Use Pyth + Chainlink fallback, max staleness check |
| Reentrancy | OpenZeppelin ReentrancyGuard on all state-changing functions |
| Front-running rebalance | Slippage tolerance + private mempool (Flashbots) for mainnet |

---

## 14. Critical Constants

```solidity
uint16 constant REBALANCE_THRESHOLD_BPS = 50;     // 0.5%
uint16 constant MAX_SLIPPAGE_BPS = 100;            // 1%
uint16 constant ALLOCATION_PRECISION = 10000;      // 100%
uint256 constant ORACLE_MAX_STALENESS = 5 minutes;
uint256 constant MIN_REBALANCE_INTERVAL = 1 hours;
```

---

## Reference Documentation

- ERC-4626: https://eips.ethereum.org/EIPS/eip-4626
- ERC-2612: https://eips.ethereum.org/EIPS/eip-2612
- OpenZeppelin ERC4626: https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC4626
- Foundry Book: https://book.getfoundry.sh/
- Mantle Docs: https://docs.mantle.xyz/
- Pyth on Mantle: https://docs.pyth.network/price-feeds/contract-addresses/evm
