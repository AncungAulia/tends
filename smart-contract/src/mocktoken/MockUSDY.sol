// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Mock Ondo US Dollar Yield for Mantle Sepolia testnet
contract MockUSDY is ERC20, ERC20Permit {
    constructor()
        ERC20("Ondo US Dollar Yield", "USDY")
        ERC20Permit("Ondo US Dollar Yield")
    {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
