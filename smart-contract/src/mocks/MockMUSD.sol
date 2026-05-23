// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Mock Mantle USD for Mantle Sepolia testnet
contract MockMUSD is ERC20, ERC20Permit {
    constructor()
        ERC20("Mantle USD", "mUSD")
        ERC20Permit("Mantle USD")
    {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
