// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {PriceFeed} from "../src/PriceFeed.sol";
import {MockOracleHelper} from "./MockOracleHelper.sol";

contract PriceFeedTest is BaseTest {
    // ── Initialize ───────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(priceFeed.owner(), owner);
        assertEq(priceFeed.mockOracle(), address(mockOracle));
        assertEq(priceFeed.maxStaleness(), 2 hours);
    }

    // ── Static prices ────────────────────────────────────────────────────────

    function test_StaticPrice_USDC() public view {
        assertEq(priceFeed.getPrice(address(mockUSDC)), PRICE_USDC);
    }

    function test_StaticPrice_MUSD() public view {
        assertEq(priceFeed.getPrice(address(mockMUSD)), PRICE_MUSD);
    }

    function test_SetStaticPrice_Override() public {
        vm.prank(owner);
        priceFeed.setStaticPrice(address(mockUSDC), 999e15); // $0.999

        assertEq(priceFeed.getPrice(address(mockUSDC)), 999e15);
    }

    function test_SetStaticPrice_RemoveOverride() public {
        // Remove static price → falls back to oracle
        vm.prank(owner);
        priceFeed.setStaticPrice(address(mockUSDC), 0);

        // feedId for USDC not set, so should revert NoFeedConfigured
        vm.expectRevert(abi.encodeWithSelector(PriceFeed.NoFeedConfigured.selector, address(mockUSDC)));
        priceFeed.getPrice(address(mockUSDC));
    }

    function testRevert_SetStaticPrice_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        priceFeed.setStaticPrice(address(mockUSDC), 1e18);
    }

    // ── FeedId config ────────────────────────────────────────────────────────

    function test_SetFeedId_Single() public {
        // forge-lint: disable-next-line(unsafe-typecast)
        bytes32 newFeed = bytes32("XAU");
        address fakeToken = makeAddr("fakeToken");

        vm.prank(owner);
        priceFeed.setFeedId(fakeToken, newFeed);

        assertEq(priceFeed.feedIds(fakeToken), newFeed);
    }

    function test_SetFeedIds_Batch() public {
        address[] memory tokens = new address[](2);
        tokens[0] = makeAddr("tokenA");
        tokens[1] = makeAddr("tokenB");

        bytes32[] memory ids = new bytes32[](2);
        // forge-lint: disable-next-line(unsafe-typecast)
        ids[0] = bytes32("AAPL");
        // forge-lint: disable-next-line(unsafe-typecast)
        ids[1] = bytes32("XAU");

        vm.prank(owner);
        priceFeed.setFeedIds(tokens, ids);

        assertEq(priceFeed.feedIds(tokens[0]), ids[0]);
        assertEq(priceFeed.feedIds(tokens[1]), ids[1]);
    }

    function testRevert_SetFeedIds_LengthMismatch() public {
        address[] memory tokens = new address[](2);
        tokens[0] = makeAddr("tokenA");
        tokens[1] = makeAddr("tokenB");

        bytes32[] memory ids = new bytes32[](1);
        // forge-lint: disable-next-line(unsafe-typecast)
        ids[0] = bytes32("XAU");

        vm.prank(owner);
        vm.expectRevert(PriceFeed.ArrayLengthMismatch.selector);
        priceFeed.setFeedIds(tokens, ids);
    }

    function testRevert_SetFeedId_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        // forge-lint: disable-next-line(unsafe-typecast)
        priceFeed.setFeedId(address(mockMETH), bytes32("mETH_FUNDAMENTAL"));
    }

    // ── getPrice via oracle ──────────────────────────────────────────────────

    function test_GetPrice_METH() public view {
        assertEq(priceFeed.getPrice(address(mockMETH)), PRICE_METH);
    }

    function test_GetPrice_USDY() public view {
        assertEq(priceFeed.getPrice(address(mockUSDY)), PRICE_USDY);
    }

    function test_GetPrice_AfterOracleUpdate() public {
        uint256 newPrice = 3000e18;
        mockOracle.setPrice(FEED_METH, newPrice);

        assertEq(priceFeed.getPrice(address(mockMETH)), newPrice);
    }

    function testRevert_GetPrice_NoFeedConfigured() public {
        address unknown = makeAddr("unknown");
        vm.expectRevert(abi.encodeWithSelector(PriceFeed.NoFeedConfigured.selector, unknown));
        priceFeed.getPrice(unknown);
    }

    function testRevert_GetPrice_Stale() public {
        // Warp past maxStaleness without refreshing oracle
        vm.warp(block.timestamp + 2 hours + 1);

        vm.expectRevert();
        priceFeed.getPrice(address(mockMETH));
    }

    function test_GetPrice_ExactlyAtStaleness_StillValid() public {
        vm.warp(block.timestamp + 2 hours);

        // Should not revert — elapsed == maxStaleness is allowed
        assertEq(priceFeed.getPrice(address(mockMETH)), PRICE_METH);
    }

    // ── getPriceUnsafe ───────────────────────────────────────────────────────

    function test_GetPriceUnsafe_ReturnsEvenIfStale() public {
        vm.warp(block.timestamp + 3 hours);

        (uint256 price, uint256 updateTime) = priceFeed.getPriceUnsafe(address(mockMETH));
        assertEq(price, PRICE_METH);
        assertGt(updateTime, 0);
    }

    function test_GetPriceUnsafe_StaticReturnsNow() public view {
        (uint256 price, uint256 updateTime) = priceFeed.getPriceUnsafe(address(mockUSDC));
        assertEq(price, PRICE_USDC);
        assertEq(updateTime, block.timestamp);
    }

    function test_GetPriceUnsafe_NoFeed_ReturnsZero() public {
        address unknown = makeAddr("unknown");
        (uint256 price, uint256 updateTime) = priceFeed.getPriceUnsafe(unknown);
        assertEq(price, 0);
        assertEq(updateTime, 0);
    }

    // ── setMockOracle ────────────────────────────────────────────────────────

    function test_SetMockOracle() public {
        MockOracleHelper newOracle = new MockOracleHelper();
        newOracle.setPrice(FEED_METH, 9999e18);

        vm.prank(owner);
        priceFeed.setMockOracle(address(newOracle));

        assertEq(priceFeed.mockOracle(), address(newOracle));
        assertEq(priceFeed.getPrice(address(mockMETH)), 9999e18);
    }

    function testRevert_SetMockOracle_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PriceFeed.InvalidAddress.selector);
        priceFeed.setMockOracle(address(0));
    }

    function testRevert_SetMockOracle_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        priceFeed.setMockOracle(makeAddr("oracle"));
    }

    // ── setMaxStaleness ──────────────────────────────────────────────────────

    function test_SetMaxStaleness() public {
        vm.prank(owner);
        priceFeed.setMaxStaleness(30 minutes);
        assertEq(priceFeed.maxStaleness(), 30 minutes);
    }

    function testRevert_SetMaxStaleness_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        priceFeed.setMaxStaleness(30 minutes);
    }

    // ── UUPS upgrade ─────────────────────────────────────────────────────────

    function testRevert_Upgrade_NotOwner() public {
        PriceFeed newImpl = new PriceFeed();
        vm.prank(alice);
        vm.expectRevert();
        priceFeed.upgradeToAndCall(address(newImpl), "");
    }

    function test_Upgrade_Owner_PreservesState() public {
        PriceFeed newImpl = new PriceFeed();
        vm.prank(owner);
        priceFeed.upgradeToAndCall(address(newImpl), "");

        // State preserved after upgrade
        assertEq(priceFeed.mockOracle(), address(mockOracle));
        assertEq(priceFeed.getPrice(address(mockMETH)), PRICE_METH);
        assertEq(priceFeed.getPrice(address(mockUSDC)), PRICE_USDC); // static price preserved
    }
}
