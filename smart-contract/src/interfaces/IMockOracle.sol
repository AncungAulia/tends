// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IMockOracle {
    function getPrice(bytes32 feedId) external view returns (uint256 value, uint64 updatedAt);
}
