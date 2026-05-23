// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";

contract PriceFeed is Initializable, OwnableUpgradeable, UUPSUpgradeable, IPriceFeed {
    // === Storage ===
    address public priceUpdater;
    uint256 public maxStaleness;

    mapping(address => uint256) public prices;       // token => USD price (1e18 scale)
    mapping(address => uint256) public lastUpdated;

    // Gap: 50 slots total for this contract's own vars.
    // Used: priceUpdater(1) + maxStaleness(1) + prices(1) + lastUpdated(1) = 4 → gap = 46
    // But OwnableUpgradeable and UUPSUpgradeable have their own gaps, so we track ours only.
    uint256[46] private __gap;

    // === Events ===
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event PriceUpdaterChanged(address indexed oldUpdater, address indexed newUpdater);
    event MaxStalenessChanged(uint256 oldStaleness, uint256 newStaleness);

    // === Errors ===
    error NotAuthorized();
    error StalePrice(address token, uint256 lastUpdate, uint256 elapsed);
    error ArrayLengthMismatch();
    error InvalidAddress();
    error ZeroPrice();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address _priceUpdater) external initializer {
        if (_priceUpdater == address(0)) revert InvalidAddress();
        __Ownable_init(_owner);
        priceUpdater = _priceUpdater;
        maxStaleness = 1 hours;
    }

    // === Modifiers ===

    modifier onlyUpdater() {
        if (msg.sender != priceUpdater) revert NotAuthorized();
        _;
    }

    // === Price writes (priceUpdater only) ===

    /// @notice Batch push prices. BE calls this every 5 min.
    function setPrices(address[] calldata tokens, uint256[] calldata newPrices) external onlyUpdater {
        if (tokens.length != newPrices.length) revert ArrayLengthMismatch();
        uint256 ts = block.timestamp;
        for (uint256 i = 0; i < tokens.length; i++) {
            if (newPrices[i] == 0) revert ZeroPrice();
            prices[tokens[i]] = newPrices[i];
            lastUpdated[tokens[i]] = ts;
            emit PriceUpdated(tokens[i], newPrices[i], ts);
        }
    }

    /// @notice Single price push.
    function setPrice(address token, uint256 price) external onlyUpdater {
        if (price == 0) revert ZeroPrice();
        prices[token] = price;
        lastUpdated[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }

    // === Price reads ===

    /// @notice Returns price, reverts if stale. Used by vaults during live ops.
    function getPrice(address token) external view returns (uint256) {
        uint256 lastUpdate = lastUpdated[token];
        uint256 elapsed = block.timestamp - lastUpdate;
        if (elapsed > maxStaleness) revert StalePrice(token, lastUpdate, elapsed);
        return prices[token];
    }

    /// @notice Returns price + timestamp with no staleness check. Used by BE for monitoring.
    function getPriceUnsafe(address token) external view returns (uint256 price, uint256 updateTime) {
        return (prices[token], lastUpdated[token]);
    }

    // === Admin ===

    function setPriceUpdater(address newUpdater) external onlyOwner {
        if (newUpdater == address(0)) revert InvalidAddress();
        address old = priceUpdater;
        priceUpdater = newUpdater;
        emit PriceUpdaterChanged(old, newUpdater);
    }

    function setMaxStaleness(uint256 newStaleness) external onlyOwner {
        uint256 old = maxStaleness;
        maxStaleness = newStaleness;
        emit MaxStalenessChanged(old, newStaleness);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
