// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentActivityLog {
    /// @param vault   The UserVault proxy that triggered the action (msg.sender in logActivity)
    /// @param action  Human-readable label, e.g. "REBALANCE"
    /// @param metadata ABI-encoded context (riskPreference, SwapInstructions, etc.)
    function logActivity(address vault, string calldata action, bytes calldata metadata) external;
}
