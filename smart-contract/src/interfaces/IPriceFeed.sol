// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IPriceFeed {
    function getPrice(address token) external view returns (uint256);
    function getPriceUnsafe(address token) external view returns (uint256 price, uint256 updateTime);
}
