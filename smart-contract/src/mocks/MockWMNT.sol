// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice Wrapped Mantle — WETH-style wrapper for native MNT on Mantle Sepolia testnet
/// @dev Mirrors WETH9 interface: deposit() wraps native MNT, withdraw() unwraps.
///      Also exposes open mint() faucet for testnet convenience.
contract MockWMNT is ERC20, ERC20Permit {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    error InsufficientBalance();

    constructor()
        ERC20("Wrapped Mantle", "WMNT")
        ERC20Permit("Wrapped Mantle")
    {
        _mint(msg.sender, 1_000_000 ether);
    }

    /// @notice Wrap native MNT into WMNT (1:1)
    receive() external payable {
        _wrap();
    }

    /// @notice Wrap native MNT into WMNT (1:1)
    function deposit() external payable {
        _wrap();
    }

    /// @notice Unwrap WMNT back to native MNT (1:1)
    function withdraw(uint256 wad) external {
        if (balanceOf(msg.sender) < wad) revert InsufficientBalance();
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    /// @notice Open faucet for testnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _wrap() internal {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }
}
