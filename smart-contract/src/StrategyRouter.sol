// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IDexAdapter} from "./interfaces/IDexAdapter.sol";

contract StrategyRouter is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    // === Storage ===
    address public dexAdapter;                         // slot 0
    mapping(address => bool) public authorizedVaults;  // slot 1
    mapping(address => bool) public allowedTokens;     // slot 2
    address public factory;                            // slot 3 — can authorize vaults

    uint256[46] private __gap;

    // === Events ===
    event SwapExecuted(
        address indexed vault,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event DexAdapterUpdated(address indexed oldAdapter, address indexed newAdapter);
    event VaultAuthorized(address indexed vault, bool authorized);
    event TokenAllowed(address indexed token, bool allowed);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // === Errors ===
    error UnauthorizedVault();
    error TokenNotAllowed();
    error InsufficientOutput();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _dexAdapter) external initializer {
        if (_dexAdapter == address(0)) revert ZeroAddress();
        __Ownable_init(_owner);
        dexAdapter = _dexAdapter;
    }

    // === Core ===

    /// @notice Execute a single swap on behalf of an authorized vault.
    /// @dev Vault must approve this router before calling.
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        if (!authorizedVaults[msg.sender]) revert UnauthorizedVault();
        if (!allowedTokens[tokenIn] || !allowedTokens[tokenOut]) revert TokenNotAllowed();

        // Pull tokenIn from vault into router
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        // Approve adapter to spend tokenIn
        IERC20(tokenIn).forceApprove(dexAdapter, amountIn);

        // Adapter sends tokenOut directly to the vault (recipient = msg.sender)
        amountOut = IDexAdapter(dexAdapter).swap(tokenIn, tokenOut, amountIn, minAmountOut, msg.sender);

        if (amountOut < minAmountOut) revert InsufficientOutput();

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @notice Quote expected output without executing.
    function getExpectedOutput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        return IDexAdapter(dexAdapter).quote(tokenIn, tokenOut, amountIn);
    }

    // === Admin ===

    function setDexAdapter(address newAdapter) external onlyOwner {
        if (newAdapter == address(0)) revert ZeroAddress();
        address old = dexAdapter;
        dexAdapter = newAdapter;
        emit DexAdapterUpdated(old, newAdapter);
    }

    function setFactory(address _factory) external onlyOwner {
        address old = factory;
        factory = _factory;
        emit FactoryUpdated(old, _factory);
    }

    /// @notice Owner or registered factory can authorize vaults.
    function authorizeVault(address vault, bool authorized) external {
        require(msg.sender == owner() || msg.sender == factory, "Not authorized");
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }

    /// @notice Batch-authorize vaults — useful after factory deploys many vaults.
    function authorizeVaults(address[] calldata vaults, bool authorized) external onlyOwner {
        for (uint256 i = 0; i < vaults.length; i++) {
            authorizedVaults[vaults[i]] = authorized;
            emit VaultAuthorized(vaults[i], authorized);
        }
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowed(token, allowed);
    }

    /// @notice Batch-set allowed tokens.
    function setAllowedTokens(address[] calldata tokens, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            allowedTokens[tokens[i]] = allowed;
            emit TokenAllowed(tokens[i], allowed);
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
