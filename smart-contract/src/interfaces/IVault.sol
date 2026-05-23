// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IVault is IERC4626 {
    function depositWithPermit(
        uint256 assets,
        address receiver,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares);

    /// @notice Deposit native MNT, auto-wraps to WMNT then swaps to USDC
    function depositNative(address receiver) external payable returns (uint256 shares);

    function rebalance() external;
    function emergencyPause(string calldata reason) external;
    function emergencyUnpause() external;
    function paused() external view returns (bool);
}
