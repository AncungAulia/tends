// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IPriceFeed} from "./interfaces/IPriceFeed.sol";
import {IMockOracle} from "./interfaces/IMockOracle.sol";

/// @notice Reads prices from backend-deployed MockOracle (Mantle Sepolia).
/// @dev Testnet: MockOracle at 0x26f9178b4082b68D8cC55874D377f9829Fc8C22d, relayer updates every hour.
///      Production path: upgrade this contract to read RedStone pull oracle + Ondo USDY oracle directly.
contract PriceFeed is Initializable, OwnableUpgradeable, UUPSUpgradeable, IPriceFeed {
    // === Storage ===
    address public mockOracle;
    uint256 public maxStaleness;

    // token address → bytes32 feedId used to query MockOracle (e.g. bytes32("mETH_FUNDAMENTAL"))
    mapping(address => bytes32) public feedIds;
    // token address → hardcoded 1e18 price, bypasses oracle (for stablecoins like USDC, mUSD)
    mapping(address => uint256) public staticPrices;

    // 4 slots used; reserve to 50
    uint256[46] private __gap;

    // === Events ===
    event FeedIdSet(address indexed token, bytes32 feedId);
    event StaticPriceSet(address indexed token, uint256 price);
    event MockOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event MaxStalenessUpdated(uint256 oldValue, uint256 newValue);

    // === Errors ===
    error NoFeedConfigured(address token);
    error StalePrice(address token, uint256 updatedAt, uint256 elapsed);
    error InvalidAddress();
    error ArrayLengthMismatch();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _mockOracle) external initializer {
        if (_mockOracle == address(0)) revert InvalidAddress();
        __Ownable_init(_owner);
        mockOracle = _mockOracle;
        maxStaleness = 2 hours; // relayer runs every hour, 2h gives margin
    }

    // === IPriceFeed ===

    /// @notice Returns price in 1e18 USD scale. Reverts if stale or unconfigured.
    function getPrice(address token) external view returns (uint256) {
        uint256 sp = staticPrices[token];
        if (sp > 0) return sp;

        bytes32 feedId = feedIds[token];
        if (feedId == bytes32(0)) revert NoFeedConfigured(token);

        (uint256 value, uint64 updatedAt) = IMockOracle(mockOracle).getPrice(feedId);
        uint256 elapsed = block.timestamp - updatedAt;
        if (elapsed > maxStaleness) revert StalePrice(token, updatedAt, elapsed);

        return value; // MockOracle already normalises to 18 decimals
    }

    /// @notice Returns price + timestamp without staleness check. Used for monitoring/display.
    function getPriceUnsafe(address token) external view returns (uint256 price, uint256 updateTime) {
        uint256 sp = staticPrices[token];
        if (sp > 0) return (sp, block.timestamp);

        bytes32 feedId = feedIds[token];
        if (feedId == bytes32(0)) return (0, 0);

        (uint256 value, uint64 updatedAt) = IMockOracle(mockOracle).getPrice(feedId);
        return (value, updatedAt);
    }

    // === Admin ===

    function setFeedId(address token, bytes32 feedId) external onlyOwner {
        feedIds[token] = feedId;
        emit FeedIdSet(token, feedId);
    }

    function setFeedIds(address[] calldata tokens, bytes32[] calldata _feedIds) external onlyOwner {
        if (tokens.length != _feedIds.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < tokens.length; i++) {
            feedIds[tokens[i]] = _feedIds[i];
            emit FeedIdSet(tokens[i], _feedIds[i]);
        }
    }

    /// @notice Set a hardcoded price that bypasses the oracle. Use for pegged stablecoins.
    /// @dev Set to 0 to remove the static override and fall back to oracle.
    function setStaticPrice(address token, uint256 price) external onlyOwner {
        staticPrices[token] = price;
        emit StaticPriceSet(token, price);
    }

    function setMockOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert InvalidAddress();
        address old = mockOracle;
        mockOracle = _oracle;
        emit MockOracleUpdated(old, _oracle);
    }

    function setMaxStaleness(uint256 _staleness) external onlyOwner {
        uint256 old = maxStaleness;
        maxStaleness = _staleness;
        emit MaxStalenessUpdated(old, _staleness);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
