// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IVault is IERC4626 {
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

    // --- User actions ---
    function depositWithPermit(
        uint256 assets,
        address receiver,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares);

    function depositNative(address receiver) external payable returns (uint256 shares);

    function setRiskLevel(RiskLevel level) external;
    function setCustomAllocation(uint16 lowBps, uint16 medBps, uint16 highBps) external;

    // --- Agent actions ---
    function rebalance(SwapInstruction[] calldata instructions) external;

    // --- Emergency ---
    function emergencyPause(string calldata reason) external;
    function emergencyUnpause() external;

    // --- View ---
    function riskPreference() external view returns (RiskLevel);
    function customAllocation() external view returns (uint16 lowBps, uint16 medBps, uint16 highBps);
    function paused() external view returns (bool);
}
