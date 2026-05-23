// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UserVault} from "../vaults/UserVault.sol";
import {StrategyRouter} from "../routers/StrategyRouter.sol";
import {AgentActivityLog} from "../logs/AgentActivityLog.sol";

contract VaultFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // === Storage ===
    address public implementation;   // UserVault logic contract
    address public usdc;
    address public agentExecutor;
    address public strategyRouter;
    address public activityLog;
    address public priceFeed;
    address public wmnt;

    // Tokens the agent is allowed to trade across all vaults
    address[] public allowedTokens;

    mapping(address => address) public vaultOf;  // user => vault proxy
    address[] public allVaults;

    uint256[41] private __gap;

    // === Events ===
    event VaultDeployed(address indexed user, address indexed vault);
    event ImplementationUpdated(address indexed oldImpl, address indexed newImpl);

    // === Errors ===
    error VaultAlreadyExists();
    error ZeroAddress();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _implementation,
        address _usdc,
        address _agentExecutor,
        address _strategyRouter,
        address _activityLog,
        address _priceFeed,
        address _wmnt,
        address[] calldata _allowedTokens
    ) external initializer {
        __Ownable_init(_owner);

        if (_implementation == address(0)) revert ZeroAddress();
        implementation = _implementation;
        usdc = _usdc;
        agentExecutor = _agentExecutor;
        strategyRouter = _strategyRouter;
        activityLog = _activityLog;
        priceFeed = _priceFeed;
        wmnt = _wmnt;

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            allowedTokens.push(_allowedTokens[i]);
        }
    }

    // === Vault deployment ===

    /// @notice Deploy a UUPS UserVault proxy for the caller.
    function deployVault() external returns (address vault) {
        if (vaultOf[msg.sender] != address(0)) revert VaultAlreadyExists();

        bytes memory initData = abi.encodeCall(
            UserVault.initialize,
            (
                IERC20(usdc),
                msg.sender,
                agentExecutor,
                strategyRouter,
                activityLog,
                priceFeed,
                wmnt,
                allowedTokens
            )
        );

        vault = address(new ERC1967Proxy(implementation, initData));
        vaultOf[msg.sender] = vault;
        allVaults.push(vault);

        // Grant the new vault permission to swap via StrategyRouter
        StrategyRouter(strategyRouter).authorizeVault(vault, true);
        // Grant the new vault permission to write to AgentActivityLog
        AgentActivityLog(activityLog).authorizeLogger(vault, true);

        emit VaultDeployed(msg.sender, vault);
    }

    // === Admin ===

    /// @notice Point factory to a new UserVault implementation.
    /// @dev Existing vaults upgrade independently via their own upgradeToAndCall.
    function setImplementation(address newImpl) external onlyOwner {
        if (newImpl == address(0)) revert ZeroAddress();
        address old = implementation;
        implementation = newImpl;
        emit ImplementationUpdated(old, newImpl);
    }

    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
