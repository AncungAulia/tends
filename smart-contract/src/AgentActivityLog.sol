// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AgentActivityLog is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // === Types ===

    struct Activity {
        uint256 id;
        address vault;       // UserVault proxy that logged this
        address agent;       // tx.origin — Hermes agent EOA (identification only, not auth)
        string  action;      // e.g. "REBALANCE"
        bytes   metadata;    // abi-encoded context (riskPreference, SwapInstructions, ...)
        uint256 timestamp;
        uint256 blockNumber;
    }

    // === Storage ===
    mapping(uint256 => Activity) public activities;          // id → Activity
    uint256 public totalActivities;                          // also used as next id counter

    mapping(address => uint256[]) public activitiesByVault;  // vault  → [ids]
    mapping(address => uint256[]) public activitiesByAgent;  // agent  → [ids]
    mapping(address => bool)      public authorizedLoggers;  // vault proxies + agentExecutor

    address public factory; // can authorize loggers without going through owner

    uint256[44] private __gap; // 6 slots used; reserve to 50

    // === Events ===
    event ActivityLogged(
        uint256 indexed id,
        address indexed vault,
        address indexed agent,
        string  action,
        uint256 timestamp
    );
    event LoggerAuthorized(address indexed logger, bool authorized);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // === Errors ===
    error NotAuthorized();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) external initializer {
        __Ownable_init(_owner);
    }

    // === Core ===

    /// @notice Called by authorized vault proxies after each agent action.
    /// @dev vault = msg.sender (the proxy), agent = tx.origin (Hermes EOA — id only).
    function logActivity(
        address vault,
        string calldata action,
        bytes calldata metadata
    ) external {
        if (!authorizedLoggers[msg.sender]) revert NotAuthorized();

        uint256 id = ++totalActivities;

        activities[id] = Activity({
            id:          id,
            vault:       vault,
            agent:       tx.origin,
            action:      action,
            metadata:    metadata,
            timestamp:   block.timestamp,
            blockNumber: block.number
        });

        activitiesByVault[vault].push(id);
        activitiesByAgent[tx.origin].push(id);

        emit ActivityLogged(id, vault, tx.origin, action, block.timestamp);
    }

    // === Queries ===

    /// @notice Most recent `count` activities across all vaults (newest first).
    function getRecentActivities(uint256 count)
        external
        view
        returns (Activity[] memory result)
    {
        uint256 limit = count > totalActivities ? totalActivities : count;
        result = new Activity[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = activities[totalActivities - i];
        }
    }

    /// @notice Most recent `count` activities for a specific vault (newest first).
    function getActivitiesByVault(address vault, uint256 count)
        external
        view
        returns (Activity[] memory result)
    {
        uint256[] storage ids = activitiesByVault[vault];
        uint256 limit = count > ids.length ? ids.length : count;
        result = new Activity[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = activities[ids[ids.length - 1 - i]];
        }
    }

    /// @notice Most recent `count` activities triggered by a specific agent (newest first).
    function getActivitiesByAgent(address agent, uint256 count)
        external
        view
        returns (Activity[] memory result)
    {
        uint256[] storage ids = activitiesByAgent[agent];
        uint256 limit = count > ids.length ? ids.length : count;
        result = new Activity[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = activities[ids[ids.length - 1 - i]];
        }
    }

    // === Admin ===

    function setFactory(address _factory) external onlyOwner {
        address old = factory;
        factory = _factory;
        emit FactoryUpdated(old, _factory);
    }

    /// @notice Owner or registered factory can authorize loggers.
    function authorizeLogger(address logger, bool authorized) external {
        require(msg.sender == owner() || msg.sender == factory, "Not authorized");
        authorizedLoggers[logger] = authorized;
        emit LoggerAuthorized(logger, authorized);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
