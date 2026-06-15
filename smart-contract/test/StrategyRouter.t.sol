// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {StrategyRouter} from "../src/StrategyRouter.sol";

contract StrategyRouterTest is BaseTest {
    // Mock vault address — we'll impersonate it
    address internal mockVault;

    function setUp() public override {
        super.setUp();
        mockVault = makeAddr("mockVault");

        // Authorize mockVault manually (not via factory)
        vm.prank(owner);
        strategyRouter.authorizeVault(mockVault, true);

        // Fund mockVault with USDC for swaps
        mockUSDC.mint(mockVault, 100_000e6);
    }

    // ── Initialize ───────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(strategyRouter.owner(), owner);
        assertEq(strategyRouter.dexAdapter(), address(dexAdapter));
        assertEq(strategyRouter.factory(), address(factory));
    }

    // ── executeSwap ──────────────────────────────────────────────────────────

    function test_ExecuteSwap_USDCToMUSD() public {
        uint256 amountIn = 1000e6;
        uint256 expectedOut = dexAdapter.quote(address(mockUSDC), address(mockMUSD), amountIn);

        vm.startPrank(mockVault);
        mockUSDC.approve(address(strategyRouter), amountIn);
        uint256 amountOut = strategyRouter.executeSwap(
            address(mockUSDC), address(mockMUSD), amountIn, expectedOut * 99 / 100
        );
        vm.stopPrank();

        assertGe(amountOut, expectedOut * 99 / 100);
        assertEq(mockMUSD.balanceOf(mockVault), amountOut);
    }

    function test_ExecuteSwap_METHToUSDC() public {
        // Fund vault with mETH first
        mockMETH.mint(mockVault, 1 ether);
        uint256 amountIn = 1 ether;
        uint256 expectedOut = dexAdapter.quote(address(mockMETH), address(mockUSDC), amountIn);

        vm.startPrank(mockVault);
        mockMETH.approve(address(strategyRouter), amountIn);
        uint256 amountOut = strategyRouter.executeSwap(
            address(mockMETH), address(mockUSDC), amountIn, expectedOut * 99 / 100
        );
        vm.stopPrank();

        assertGe(amountOut, expectedOut * 99 / 100);
        // ~$2000 USDC (6 dec) minus slippage
        assertGt(amountOut, 1900e6);
    }

    function testRevert_ExecuteSwap_UnauthorizedVault() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(strategyRouter), 1000e6);
        vm.expectRevert(StrategyRouter.UnauthorizedVault.selector);
        strategyRouter.executeSwap(address(mockUSDC), address(mockMUSD), 1000e6, 0);
        vm.stopPrank();
    }

    function testRevert_ExecuteSwap_TokenNotAllowed() public {
        address badToken = makeAddr("badToken");

        vm.startPrank(mockVault);
        vm.expectRevert(StrategyRouter.TokenNotAllowed.selector);
        strategyRouter.executeSwap(badToken, address(mockMUSD), 1000e6, 0);
        vm.stopPrank();
    }

    // ── getExpectedOutput ────────────────────────────────────────────────────

    function test_GetExpectedOutput_USDCToMETH() public view {
        uint256 quote = strategyRouter.getExpectedOutput(address(mockUSDC), address(mockMETH), 2000e6);
        // $2000 USDC should get ~0.997 mETH after 0.3% slippage
        assertGt(quote, 0.99 ether);
        assertLt(quote, 1 ether);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function test_AuthorizeVault_Owner() public {
        address newVault = makeAddr("newVault");
        vm.prank(owner);
        strategyRouter.authorizeVault(newVault, true);
        assertTrue(strategyRouter.authorizedVaults(newVault));
    }

    function test_AuthorizeVault_Factory() public {
        address newVault = makeAddr("newVaultFromFactory");
        vm.prank(address(factory));
        strategyRouter.authorizeVault(newVault, true);
        assertTrue(strategyRouter.authorizedVaults(newVault));
    }

    function testRevert_AuthorizeVault_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Not authorized");
        strategyRouter.authorizeVault(makeAddr("x"), true);
    }

    function test_AuthorizeVaults_Batch() public {
        address[] memory vaults = new address[](3);
        vaults[0] = makeAddr("v1");
        vaults[1] = makeAddr("v2");
        vaults[2] = makeAddr("v3");

        vm.prank(owner);
        strategyRouter.authorizeVaults(vaults, true);

        for (uint256 i = 0; i < 3; i++) {
            assertTrue(strategyRouter.authorizedVaults(vaults[i]));
        }
    }

    function test_SetAllowedTokens_Batch() public {
        address[] memory tokens = new address[](2);
        tokens[0] = makeAddr("tkA");
        tokens[1] = makeAddr("tkB");

        vm.prank(owner);
        strategyRouter.setAllowedTokens(tokens, true);

        assertTrue(strategyRouter.allowedTokens(tokens[0]));
        assertTrue(strategyRouter.allowedTokens(tokens[1]));
    }

    function test_SetDexAdapter() public {
        address newAdapter = makeAddr("newAdapter");
        vm.prank(owner);
        strategyRouter.setDexAdapter(newAdapter);
        assertEq(strategyRouter.dexAdapter(), newAdapter);
    }

    function testRevert_SetDexAdapter_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        strategyRouter.setDexAdapter(makeAddr("x"));
    }

    function testRevert_SetDexAdapter_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(StrategyRouter.ZeroAddress.selector);
        strategyRouter.setDexAdapter(address(0));
    }

    // ── UUPS upgrade ─────────────────────────────────────────────────────────

    function testRevert_Upgrade_NotOwner() public {
        StrategyRouter newImpl = new StrategyRouter();
        vm.prank(alice);
        vm.expectRevert();
        strategyRouter.upgradeToAndCall(address(newImpl), "");
    }

    function test_Upgrade_PreservesState() public {
        StrategyRouter newImpl = new StrategyRouter();
        vm.prank(owner);
        strategyRouter.upgradeToAndCall(address(newImpl), "");

        assertEq(strategyRouter.dexAdapter(), address(dexAdapter));
        assertTrue(strategyRouter.authorizedVaults(mockVault));
    }
}
