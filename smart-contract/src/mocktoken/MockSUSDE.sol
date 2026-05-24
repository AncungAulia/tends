// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Mock Staked USDe for Mantle Sepolia testnet
contract MockSUSDE is ERC20, ERC20Permit {
    constructor()
        ERC20("Staked USDe", "sUSDe")
        ERC20Permit("Staked USDe")
    {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
