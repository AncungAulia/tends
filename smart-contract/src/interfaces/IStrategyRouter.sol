// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategyRouter {
    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256);
    function getExpectedOutput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}
