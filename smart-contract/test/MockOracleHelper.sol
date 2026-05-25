// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @dev Simulates IMockOracle for unit tests. Mirrors the interface of
///      the backend-deployed MockOracle at 0x26f9178b4082b68D8cC55874D377f9829Fc8C22d.
contract MockOracleHelper {
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => uint64) public timestamps;

    function setPrice(bytes32 feedId, uint256 price) external {
        prices[feedId] = price;
        timestamps[feedId] = uint64(block.timestamp);
    }

    function getPrice(bytes32 feedId) external view returns (uint256 value, uint64 updatedAt) {
        return (prices[feedId], timestamps[feedId]);
    }
}
