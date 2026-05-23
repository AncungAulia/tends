// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDexAdapter {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient) external returns (uint256);
    function quote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}
