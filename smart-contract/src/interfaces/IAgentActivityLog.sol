// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentActivityLog {
    function logActivity(uint8 vaultId, string calldata action, bytes calldata metadata) external;
}
