// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";

contract MockDexAdapterTest is BaseTest {
    // Mock caller (impersonates a router)
    address internal caller;

    function setUp() public override {
        super.setUp();
        caller = makeAddr("caller");

        // Fund caller with tokens so it can transfer to adapter
        mockUSDC.mint(caller, 10_000e6);
        mockMETH.mint(caller, 10 ether);
        mockMUSD.mint(caller, 10_000 ether);
    }

    // ── quote ────────────────────────────────────────────────────────────────

    function test_Quote_USDCToMETH() public view {
        // $2000 USDC → mETH at $2000 each → expect ~1 mETH minus 0.3% slippage
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockMETH), 2000e6);
        assertGt(out, 0.99 ether);
        assertLt(out, 1 ether);
    }

    function test_Quote_METHToUSDC() public view {
        // 1 mETH at $2000 → expect ~$2000 USDC minus 0.3% slippage
        uint256 out = dexAdapter.quote(address(mockMETH), address(mockUSDC), 1 ether);
        assertGt(out, 1990e6);
        assertLt(out, 2000e6);
    }

    function test_Quote_USDCToMUSD() public view {
        // mUSD ≈ USDC in price, so 1000 USDC → ~997 mUSD after slippage
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockMUSD), 1000e6);
        assertGt(out, 996 ether);
        assertLt(out, 1000 ether);
    }

    function test_Quote_WMNTToUSDC() public view {
        // 1 WMNT at $0.50 → ~$0.4985 USDC after slippage
        uint256 out = dexAdapter.quote(address(mockWMNT), address(mockUSDC), 1 ether);
        assertGt(out, 498_000);    // > 0.498 USDC
        assertLt(out, 500_000);    // < 0.500 USDC
    }

    function test_Quote_MockSlippage_Applied() public view {
        // Perfect output (no slippage) would be exactly 1 mETH for $2000 at $2000/mETH
        // After 0.3% slippage: 1 ether * (10000 - 30) / 10000 = 0.997 ether
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockMETH), 2000e6);
        uint256 perfect = 1 ether; // theoretical perfect output
        uint256 expected = (perfect * (10000 - 30)) / 10000;
        assertEq(out, expected);
    }

    // ── swap ─────────────────────────────────────────────────────────────────

    function test_Swap_USDCToMUSD_TransfersCorrectly() public {
        uint256 amountIn = 1000e6;
        uint256 expected = dexAdapter.quote(address(mockUSDC), address(mockMUSD), amountIn);
        address recipient = makeAddr("recipient");

        vm.startPrank(caller);
        mockUSDC.approve(address(dexAdapter), amountIn);
        uint256 amountOut = dexAdapter.swap(
            address(mockUSDC), address(mockMUSD), amountIn, expected * 99 / 100, recipient
        );
        vm.stopPrank();

        assertEq(amountOut, expected);
        assertEq(mockMUSD.balanceOf(recipient), expected);
        assertEq(mockUSDC.balanceOf(address(dexAdapter)), 10_000_000e6 + amountIn); // dex accumulated tokenIn
    }

    function test_Swap_METHToUSDC_TransfersCorrectly() public {
        uint256 amountIn = 1 ether;
        uint256 expected = dexAdapter.quote(address(mockMETH), address(mockUSDC), amountIn);
        address recipient = makeAddr("recipient");

        vm.startPrank(caller);
        mockMETH.approve(address(dexAdapter), amountIn);
        uint256 amountOut = dexAdapter.swap(
            address(mockMETH), address(mockUSDC), amountIn, expected * 99 / 100, recipient
        );
        vm.stopPrank();

        assertEq(amountOut, expected);
        assertGt(mockUSDC.balanceOf(recipient), 1990e6);
    }

    function testRevert_Swap_SlippageTooHigh() public {
        uint256 amountIn = 1000e6;
        uint256 impossibleMin = 2000 ether; // expect 2000 mUSD for $1000, impossible

        vm.startPrank(caller);
        mockUSDC.approve(address(dexAdapter), amountIn);
        vm.expectRevert();
        dexAdapter.swap(address(mockUSDC), address(mockMUSD), amountIn, impossibleMin, caller);
        vm.stopPrank();
    }

    function testRevert_Swap_ZeroPrice() public {
        // Use a token with no price set in PriceFeed
        address ghostToken = makeAddr("ghostToken");

        vm.expectRevert();
        dexAdapter.quote(ghostToken, address(mockUSDC), 1000e6);
    }

    function test_Swap_DifferentRecipient() public {
        address recipient = makeAddr("recipient");
        uint256 amountIn = 500e6;

        vm.startPrank(caller);
        mockUSDC.approve(address(dexAdapter), amountIn);
        uint256 out = dexAdapter.swap(
            address(mockUSDC), address(mockMUSD), amountIn, 0, recipient
        );
        vm.stopPrank();

        assertGt(out, 0);
        assertEq(mockMUSD.balanceOf(recipient), out);
        assertEq(mockMUSD.balanceOf(caller), 10_000 ether); // setUp minted 10k mUSD to caller, unchanged
    }

    function test_Quote_USDCToUSDY() public view {
        // 2000 USDC → USDY at $1.05 → theoretical 1904.76 USDY → after 0.3% slippage ~1899
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockUSDY), 2000e6);
        assertGt(out, 1890 ether);
        assertLt(out, 1910 ether);
    }

    function test_Quote_USDCToCMETH() public view {
        // 2100 USDC → cmETH at $2100 → 1 cmETH → after slippage 0.997
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockCMETH), 2100e6);
        assertGt(out, 0.99 ether);
        assertLt(out, 1 ether);
    }

    function test_Quote_USDCToSUSDE() public view {
        // 1080 USDC → sUSDe at $1.08 → 1000 sUSDe → after slippage ~997
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockSUSDE), 1080e6);
        assertGt(out, 994 ether);
        assertLt(out, 1001 ether);
    }

    function test_Quote_USDCToWMNT() public view {
        // 100 USDC → WMNT at $0.50 → 200 WMNT → after slippage ~199.4
        uint256 out = dexAdapter.quote(address(mockUSDC), address(mockWMNT), 100e6);
        assertGt(out, 199 ether);
        assertLt(out, 200 ether);
    }

    function test_Quote_USDYToUSDC() public view {
        // 100 USDY at $1.05 → ~$105 USDC → after slippage ~104.685
        uint256 out = dexAdapter.quote(address(mockUSDY), address(mockUSDC), 100 ether);
        assertGt(out, 104_600_000);
        assertLt(out, 105_000_000);
    }

    function test_Quote_CMETHToUSDC() public view {
        // 1 cmETH at $2100 → $2100 USDC → after slippage ~2093.7
        uint256 out = dexAdapter.quote(address(mockCMETH), address(mockUSDC), 1 ether);
        assertGt(out, 2_090_000_000);
        assertLt(out, 2_100_000_000);
    }

    function test_Quote_SUSDeToUSDC() public view {
        // 100 sUSDe at $1.08 → $108 USDC → after slippage ~107.676
        uint256 out = dexAdapter.quote(address(mockSUSDE), address(mockUSDC), 100 ether);
        assertGt(out, 107_600_000);
        assertLt(out, 108_000_000);
    }

    function test_Swap_USDCToUSDY_TransfersCorrectly() public {
        uint256 amountIn = 1050e6;
        mockUSDY.mint(address(dexAdapter), 10_000_000 ether);
        mockUSDC.mint(caller, amountIn);

        uint256 expected = dexAdapter.quote(address(mockUSDC), address(mockUSDY), amountIn);
        address recipient = makeAddr("recipient");

        vm.startPrank(caller);
        mockUSDC.approve(address(dexAdapter), amountIn);
        uint256 amountOut = dexAdapter.swap(
            address(mockUSDC), address(mockUSDY), amountIn, expected * 99 / 100, recipient
        );
        vm.stopPrank();

        assertEq(amountOut, expected);
        assertEq(mockUSDY.balanceOf(recipient), expected);
    }

    function test_Swap_CMETHToUSDC_TransfersCorrectly() public {
        uint256 amountIn = 1 ether;
        mockCMETH.mint(caller, amountIn);

        uint256 expected = dexAdapter.quote(address(mockCMETH), address(mockUSDC), amountIn);
        address recipient = makeAddr("recipient");

        vm.startPrank(caller);
        mockCMETH.approve(address(dexAdapter), amountIn);
        uint256 amountOut = dexAdapter.swap(
            address(mockCMETH), address(mockUSDC), amountIn, expected * 99 / 100, recipient
        );
        vm.stopPrank();

        assertEq(amountOut, expected);
        assertGt(mockUSDC.balanceOf(recipient), 2_090_000_000); // >$2090 USDC
    }
}
