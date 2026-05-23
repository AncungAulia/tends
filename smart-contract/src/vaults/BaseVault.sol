// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";
import {IStrategyRouter} from "../interfaces/IStrategyRouter.sol";
import {IAgentActivityLog} from "../interfaces/IAgentActivityLog.sol";
import {IWMNT} from "../interfaces/IWMNT.sol";

abstract contract BaseVault is
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    // === Storage ===
    // Slot 0: strategyId (uint8) + agentExecutor (address) packed
    uint8 public strategyId;
    address public agentExecutor;

    address public strategyRouter;  // slot 1
    address public activityLog;     // slot 2
    address public priceFeed;       // slot 3
    address public wmnt;            // slot 4 — WMNT for native MNT deposit

    struct AssetAllocation {
        address token;
        uint16 targetBps;
    }
    AssetAllocation[] public targetAllocations; // slot 5

    // Slot 6: rebalanceThresholdBps + maxSlippageBps packed
    uint16 public rebalanceThresholdBps;
    uint16 public maxSlippageBps;

    uint256 public lastRebalanceTime;    // slot 7
    uint256 public minRebalanceInterval; // slot 8
    bool public paused;                  // slot 9

    // 10 slots used above; reserve to 48 total for this contract's own storage
    uint256[38] private __gap;

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
    error ZeroAmount();

    // === Modifiers ===

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

    // === Init ===

    function __BaseVault_init(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        uint8 _strategyId,
        address _owner,
        address _agentExecutor,
        address _strategyRouter,
        address _activityLog,
        address _priceFeed,
        address _wmnt
    ) internal onlyInitializing {
        __ERC4626_init(_asset);
        __ERC20_init(_name, _symbol);
        __Ownable_init(_owner);

        strategyId = _strategyId;
        agentExecutor = _agentExecutor;
        strategyRouter = _strategyRouter;
        activityLog = _activityLog;
        priceFeed = _priceFeed;
        wmnt = _wmnt;

        rebalanceThresholdBps = 50;
        maxSlippageBps = 100;
        minRebalanceInterval = 1 hours;
    }

    // === ERC-4626 overrides ===

    /// @notice Total vault value denominated in asset (USDC) decimals.
    function totalAssets() public view virtual override returns (uint256 total) {
        uint8 usdcDec = IERC20Metadata(asset()).decimals();

        // Raw USDC sitting in the vault (not yet swapped to RWA tokens)
        uint256 totalNorm = IERC20(asset()).balanceOf(address(this)) * (10 ** (18 - usdcDec));

        for (uint256 i = 0; i < targetAllocations.length; i++) {
            address token = targetAllocations[i].token;
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal == 0) continue;

            uint256 price = IPriceFeed(priceFeed).getPrice(token); // 1e18 USD per token
            uint8 tokenDec = IERC20Metadata(token).decimals();
            uint256 balNorm = bal * (10 ** (18 - tokenDec));
            totalNorm += (balNorm * price) / 1e18;
        }

        // Bring back to USDC decimals
        total = totalNorm / (10 ** (18 - usdcDec));
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

    // withdraw + redeem intentionally NOT paused — users can always exit

    // === Deposit helpers ===

    /// @notice ERC-2612 permit + deposit in one tx.
    function depositWithPermit(
        uint256 assets,
        address receiver,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused_ returns (uint256 shares) {
        IERC20Permit(asset()).permit(msg.sender, address(this), assets, deadline, v, r, s);
        return deposit(assets, receiver);
    }

    /// @notice Wrap native MNT → WMNT → swap to USDC → deposit.
    function depositNative(address receiver)
        external
        payable
        whenNotPaused_
        nonReentrant
        returns (uint256 shares)
    {
        if (msg.value == 0) revert ZeroAmount();

        // 1. Wrap native MNT to WMNT (1:1)
        IWMNT(wmnt).deposit{value: msg.value}();

        // 2. Swap WMNT → USDC via StrategyRouter
        IWMNT(wmnt).approve(strategyRouter, msg.value);
        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(wmnt, asset(), msg.value);
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;
        uint256 usdcAmount = IStrategyRouter(strategyRouter).executeSwap(
            wmnt, asset(), msg.value, minReceived
        );

        // 3. Mint shares — vault already holds the USDC from the swap output
        uint256 maxAssets = maxDeposit(receiver);
        if (usdcAmount > maxAssets) revert ERC4626ExceededMaxDeposit(receiver, usdcAmount, maxAssets);
        shares = previewDeposit(usdcAmount);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, usdcAmount, shares);
    }

    // === Agent: rebalance ===

    function rebalance() external onlyAgent whenNotPaused_ nonReentrant {
        if (block.timestamp < lastRebalanceTime + minRebalanceInterval) revert RebalanceTooSoon();

        AssetAllocation[] memory oldAllocation = _captureCurrentAllocation();
        uint256 totalValue = totalAssets(); // USDC decimals

        for (uint256 i = 0; i < targetAllocations.length; i++) {
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

    // === Admin ===

    function setAgentExecutor(address newAgent) external onlyOwner {
        address old = agentExecutor;
        agentExecutor = newAgent;
        emit AgentExecutorUpdated(old, newAgent);
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

    // === Internal ===

    function _captureCurrentAllocation() internal view returns (AssetAllocation[] memory result) {
        result = new AssetAllocation[](targetAllocations.length);
        for (uint256 i = 0; i < targetAllocations.length; i++) {
            result[i] = targetAllocations[i];
        }
    }

    /// @notice Current USD value of `token` held by this vault, in USDC decimals.
    function _getCurrentValueOf(address token) internal view returns (uint256) {
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) return 0;

        uint256 price = IPriceFeed(priceFeed).getPrice(token); // 1e18 USD per token
        uint8 tokenDec = IERC20Metadata(token).decimals();
        uint8 usdcDec = IERC20Metadata(asset()).decimals();

        uint256 balNorm = bal * (10 ** (18 - tokenDec));          // token balance in 1e18
        uint256 valueNorm = (balNorm * price) / 1e18;              // USD value in 1e18
        return valueNorm / (10 ** (18 - usdcDec));                 // back to USDC decimals
    }

    /// @notice Buy `token` using `amountUSDC` (in USDC decimals) from vault balance.
    function _executeBuy(address token, uint256 amountUSDC) internal {
        IERC20(asset()).approve(strategyRouter, amountUSDC);

        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(asset(), token, amountUSDC);
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;

        IStrategyRouter(strategyRouter).executeSwap(asset(), token, amountUSDC, minReceived);
    }

    /// @notice Sell enough `token` to realise `valueUSDC` (in USDC decimals).
    function _executeSell(address token, uint256 valueUSDC) internal {
        uint256 price = IPriceFeed(priceFeed).getPrice(token);
        uint8 tokenDec = IERC20Metadata(token).decimals();
        uint8 usdcDec = IERC20Metadata(asset()).decimals();

        // Normalize valueUSDC → 1e18, then compute token amount in token's native decimals
        uint256 valueNorm = valueUSDC * (10 ** (18 - usdcDec));
        uint256 amountToken = (valueNorm * (10 ** tokenDec)) / price;

        IERC20(token).approve(strategyRouter, amountToken);

        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(token, asset(), amountToken);
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;

        IStrategyRouter(strategyRouter).executeSwap(token, asset(), amountToken, minReceived);
    }

    /// @notice Implemented by concrete vaults (Low/Medium/High) with their own allocation logic.
    function _rebalanceAsset(AssetAllocation memory target, uint256 totalValue) internal virtual;

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
