// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Mock Mantle Staked Ether for Mantle Sepolia testnet
contract MockMETH is ERC20, ERC20Permit {
    constructor()
        ERC20("Mantle Staked Ether", "mETH")
        ERC20Permit("Mantle Staked Ether")
    {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
