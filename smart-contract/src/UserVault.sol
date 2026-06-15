// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {IPriceFeed} from "./interfaces/IPriceFeed.sol";
import {IStrategyRouter} from "./interfaces/IStrategyRouter.sol";
import {IAgentActivityLog} from "./interfaces/IAgentActivityLog.sol";
import {IWMNT} from "./interfaces/IWMNT.sol";

contract UserVault is
    Initializable,
    ERC4626Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable
{
    // === Types ===

    enum RiskLevel { LOW, MEDIUM, HIGH, CUSTOM }

    struct SwapInstruction {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    struct CustomAllocation {
        uint16 lowBps;
        uint16 medBps;
        uint16 highBps;
    }

    // === Storage ===
    // Slot 0: agentExecutor (address, 20 bytes)
    address public agentExecutor;
    // Slot 1: strategyRouter
    address public strategyRouter;
    // Slot 2: activityLog
    address public activityLog;
    // Slot 3: priceFeed
    address public priceFeed;
    // Slot 4: wmnt
    address public wmnt;
    // Slot 5: riskPreference (uint8,1) + customAllocation (3×uint16,6) packed = 7 bytes
    RiskLevel public riskPreference;
    CustomAllocation public customAllocation;
    // Slot 6: allowedTokens array pointer
    address[] public allowedTokens;
    // Slot 7: isAllowedToken mapping
    mapping(address => bool) public isAllowedToken;
    // Slot 8: maxSlippageBps (uint16,2) + paused (bool,1) packed
    uint16 public maxSlippageBps;
    bool public paused;
    // Slot 9: lastRebalanceTime
    uint256 public lastRebalanceTime;
    // Slot 10: minRebalanceInterval
    uint256 public minRebalanceInterval;

    // 11 slots used; reserve to 50 total
    uint256[39] private __gap;

    // === Events ===
    event Rebalanced(uint256 timestamp, address indexed agent, SwapInstruction[] instructions);
    event RiskPreferenceUpdated(address indexed user, RiskLevel level, uint16 lowBps, uint16 medBps, uint16 highBps);
    event AgentExecutorUpdated(address indexed oldAgent, address indexed newAgent);
    event EmergencyPaused(address indexed by, string reason);
    event EmergencyUnpaused(address indexed by);
    event MinRebalanceIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event AllowedTokenUpdated(address indexed token, bool allowed);

    // === Errors ===
    error NotAuthorizedAgent();
    error VaultPaused();
    error TokenNotAllowed();
    error InvalidAllocationSum();
    error ZeroAmount();
    error CooldownNotElapsed(uint256 availableAt);

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

    function initialize(
        IERC20 _usdc,
        address _owner,
        address _agentExecutor,
        address _strategyRouter,
        address _activityLog,
        address _priceFeed,
        address _wmnt,
        address[] calldata _allowedTokens
    ) external initializer {
        __ERC4626_init(_usdc);
        __ERC20_init("Tends User Vault", "tVAULT");
        __Ownable_init(_owner);

        agentExecutor = _agentExecutor;
        strategyRouter = _strategyRouter;
        activityLog = _activityLog;
        priceFeed = _priceFeed;
        wmnt = _wmnt;

        maxSlippageBps = 100; // 1%
        riskPreference = RiskLevel.LOW;

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            allowedTokens.push(_allowedTokens[i]);
            isAllowedToken[_allowedTokens[i]] = true;
        }
    }

    // === ERC-4626 overrides ===

    /// @notice Total vault value in asset (USDC) decimals.
    function totalAssets() public view override returns (uint256 total) {
        uint8 usdcDec = IERC20Metadata(asset()).decimals();
        uint256 totalNorm = IERC20(asset()).balanceOf(address(this)) * (10 ** (18 - usdcDec));

        for (uint256 i = 0; i < allowedTokens.length; i++) {
            address token = allowedTokens[i];
            if (token == asset()) continue; // already counted above
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal == 0) continue;

            (uint256 price, ) = IPriceFeed(priceFeed).getPriceUnsafe(token);
            if (price == 0) continue;
            uint8 tokenDec = IERC20Metadata(token).decimals();
            uint256 balNorm = bal * (10 ** (18 - tokenDec));
            totalNorm += (balNorm * price) / 1e18;
        }

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

    // === User: deposit helpers ===

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

        IWMNT(wmnt).deposit{value: msg.value}();
        IWMNT(wmnt).approve(strategyRouter, msg.value);

        uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(wmnt, asset(), msg.value);
        uint256 minReceived = (expected * (10000 - maxSlippageBps)) / 10000;
        uint256 usdcAmount = IStrategyRouter(strategyRouter).executeSwap(
            wmnt, asset(), msg.value, minReceived
        );

        // USDC already in vault from swap — mint shares directly
        uint256 maxAssets = maxDeposit(receiver);
        if (usdcAmount > maxAssets) revert ERC4626ExceededMaxDeposit(receiver, usdcAmount, maxAssets);
        shares = previewDeposit(usdcAmount);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, usdcAmount, shares);
    }

    // === User: preference ===

    /// @notice Set risk level. Agent reads this at next rebalance.
    function setRiskLevel(RiskLevel level) external onlyOwner {
        if (level == RiskLevel.CUSTOM) revert InvalidAllocationSum(); // use setCustomAllocation instead
        riskPreference = level;
        emit RiskPreferenceUpdated(msg.sender, level, 0, 0, 0);
    }

    /// @notice Set custom allocation bps. Automatically sets riskPreference to CUSTOM.
    function setCustomAllocation(uint16 lowBps, uint16 medBps, uint16 highBps) external onlyOwner {
        if (uint256(lowBps) + medBps + highBps != 10000) revert InvalidAllocationSum();
        riskPreference = RiskLevel.CUSTOM;
        customAllocation = CustomAllocation({lowBps: lowBps, medBps: medBps, highBps: highBps});
        emit RiskPreferenceUpdated(msg.sender, RiskLevel.CUSTOM, lowBps, medBps, highBps);
    }

    /// @notice Set the minimum time (seconds) between rebalances. 0 = no on-chain cooldown.
    function setMinRebalanceInterval(uint256 interval) external onlyOwner {
        uint256 old = minRebalanceInterval;
        minRebalanceInterval = interval;
        emit MinRebalanceIntervalUpdated(old, interval);
    }

    // === Agent: liquidate for withdrawal ===

    /// @notice Sell all non-USDC holdings to USDC so the user can immediately withdraw.
    ///         Called by the backend before returning a withdraw tx — no cooldown applies
    ///         (unlike rebalance) and lastRebalanceTime is intentionally NOT updated.
    function agentLiquidate() external onlyAgent nonReentrant {
        address usdc_ = asset();
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            address token = allowedTokens[i];
            if (token == usdc_) continue;
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal == 0) continue;
            uint256 expected = IStrategyRouter(strategyRouter).getExpectedOutput(token, usdc_, bal);
            if (expected == 0) continue;
            uint256 minOut = (expected * (10_000 - maxSlippageBps)) / 10_000;
            IERC20(token).approve(strategyRouter, bal);
            IStrategyRouter(strategyRouter).executeSwap(token, usdc_, bal, minOut);
        }
    }

    // === Agent: rebalance ===

    /// @notice Execute a set of swaps as determined by agent Hermes from skill.md strategy.
    function rebalance(SwapInstruction[] calldata instructions)
        external
        onlyAgent
        whenNotPaused_
        nonReentrant
    {
        if (minRebalanceInterval > 0) {
            uint256 availableAt = lastRebalanceTime + minRebalanceInterval;
            if (block.timestamp < availableAt) revert CooldownNotElapsed(availableAt);
        }

        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction calldata inst = instructions[i];

            // USDC (asset) is always allowed as tokenIn or tokenOut
            if (inst.tokenIn != asset() && !isAllowedToken[inst.tokenIn]) revert TokenNotAllowed();
            if (inst.tokenOut != asset() && !isAllowedToken[inst.tokenOut]) revert TokenNotAllowed();

            IERC20(inst.tokenIn).approve(strategyRouter, inst.amountIn);
            IStrategyRouter(strategyRouter).executeSwap(
                inst.tokenIn, inst.tokenOut, inst.amountIn, inst.minAmountOut
            );
        }

        lastRebalanceTime = block.timestamp;

        emit Rebalanced(block.timestamp, msg.sender, instructions);

        IAgentActivityLog(activityLog).logActivity(
            address(this),
            "REBALANCE",
            abi.encode(uint8(riskPreference), instructions)
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

    /// @notice Add tokens to the vault's tradeable whitelist.
    function addAllowedTokens(address[] calldata tokens) external {
        require(msg.sender == owner() || msg.sender == agentExecutor, "Not authorized");
        for (uint256 i = 0; i < tokens.length; i++) {
            address t = tokens[i];
            if (!isAllowedToken[t]) {
                allowedTokens.push(t);
                isAllowedToken[t] = true;
            }
        }
    }

    /// @notice Add or remove a single token from the vault's tradeable allowlist.
    ///         Removal uses swap-and-pop; does NOT check for existing token balance —
    ///         caller should liquidate the token first.
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        if (allowed) {
            if (!isAllowedToken[token]) {
                allowedTokens.push(token);
                isAllowedToken[token] = true;
            }
        } else {
            if (isAllowedToken[token]) {
                isAllowedToken[token] = false;
                uint256 len = allowedTokens.length;
                for (uint256 i = 0; i < len; i++) {
                    if (allowedTokens[i] == token) {
                        allowedTokens[i] = allowedTokens[len - 1];
                        allowedTokens.pop();
                        break;
                    }
                }
            }
        }
        emit AllowedTokenUpdated(token, allowed);
    }

    function _authorizeUpgrade(address) internal override {
        require(msg.sender == owner() || msg.sender == agentExecutor, "Not authorized");
    }
}
