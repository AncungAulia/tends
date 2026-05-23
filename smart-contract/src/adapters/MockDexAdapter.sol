// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IDexAdapter} from "../interfaces/IDexAdapter.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

/// @notice Mock DEX adapter for Mantle Sepolia testnet.
/// @dev Price-feed-based swap ratios with a fixed 0.3% mock slippage.
///      Adapter must hold sufficient tokenOut balance to fulfill swaps —
///      fund it via FundMocks.s.sol after deployment.
contract MockDexAdapter is IDexAdapter {
    using SafeERC20 for IERC20;

    address public immutable priceFeed;
    uint256 public constant MOCK_SLIPPAGE_BPS = 30; // 0.3%

    error SlippageTooHigh(uint256 amountOut, uint256 minAmountOut);
    error ZeroPrice(address token);

    constructor(address _priceFeed) {
        priceFeed = _priceFeed;
    }

    // === IDexAdapter ===

    /// @notice Execute swap. Pulls tokenIn from caller (router), sends tokenOut to recipient.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = _quote(tokenIn, tokenOut, amountIn);
        if (amountOut < minAmountOut) revert SlippageTooHigh(amountOut, minAmountOut);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);
    }

    /// @notice Quote output amount without executing.
    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        return _quote(tokenIn, tokenOut, amountIn);
    }

    // === Internal ===

    function _quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256) {
        uint256 priceIn  = IPriceFeed(priceFeed).getPrice(tokenIn);   // 1e18 USD/token
        uint256 priceOut = IPriceFeed(priceFeed).getPrice(tokenOut);  // 1e18 USD/token
        if (priceIn == 0) revert ZeroPrice(tokenIn);
        if (priceOut == 0) revert ZeroPrice(tokenOut);

        uint8 decIn  = IERC20Metadata(tokenIn).decimals();
        uint8 decOut = IERC20Metadata(tokenOut).decimals();

        // Normalize amountIn to 1e18 scale
        uint256 amountInNorm = amountIn * (10 ** (18 - decIn));
        // USD value of amountIn (1e18 scale)
        uint256 valueIn = (amountInNorm * priceIn) / 1e18;
        // Equivalent tokenOut amount normalized to 1e18
        uint256 amountOutNorm = (valueIn * 1e18) / priceOut;
        // Apply mock slippage
        amountOutNorm = (amountOutNorm * (10000 - MOCK_SLIPPAGE_BPS)) / 10000;
        // Convert back to tokenOut native decimals
        return amountOutNorm / (10 ** (18 - decOut));
    }
}
