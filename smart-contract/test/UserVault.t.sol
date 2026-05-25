// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {UserVault} from "../src/UserVault.sol";
import {AgentActivityLog} from "../src/AgentActivityLog.sol";

contract UserVaultTest is BaseTest {
    UserVault internal aliceVault;
    UserVault internal bobVault;

    function setUp() public override {
        super.setUp();
        aliceVault = _deployVaultFor(alice);
        bobVault   = _deployVaultFor(bob);
    }

    // ── Initialize ───────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(aliceVault.owner(), alice);
        assertEq(aliceVault.agentExecutor(), agentExecutor);
        assertEq(aliceVault.strategyRouter(), address(strategyRouter));
        assertEq(aliceVault.activityLog(), address(activityLog));
        assertEq(aliceVault.priceFeed(), address(priceFeed));
        assertEq(aliceVault.wmnt(), address(mockWMNT));
        assertEq(aliceVault.asset(), address(mockUSDC));
        assertFalse(aliceVault.paused());
        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.LOW));
        assertEq(aliceVault.maxSlippageBps(), 100);
        assertEq(aliceVault.minRebalanceInterval(), 1 hours);
        assertEq(aliceVault.totalAssets(), 0);
        assertEq(aliceVault.totalSupply(), 0);
    }

    // ── Deposit ──────────────────────────────────────────────────────────────

    function test_Deposit_Alice_FirstDeposit_OneToOne() public {
        uint256 amount = 1000e6;
        uint256 shares = _deposit(alice, aliceVault, amount);

        // ERC-4626 virtual offset: shares ≈ amount on first deposit
        assertGt(shares, 0);
        assertEq(aliceVault.balanceOf(alice), shares);
        assertEq(mockUSDC.balanceOf(address(aliceVault)), amount);
    }

    function test_Deposit_TwoUsers_SeparateVaults() public {
        _deposit(alice, aliceVault, 1000e6);
        _deposit(bob, bobVault, 2000e6);

        assertEq(aliceVault.totalAssets(), 1000e6);
        assertEq(bobVault.totalAssets(), 2000e6);
        assertEq(aliceVault.balanceOf(bob), 0);
        assertEq(bobVault.balanceOf(alice), 0);
    }

    function test_Deposit_SecondDeposit_SharesProportional() public {
        _deposit(alice, aliceVault, 1000e6);
        uint256 sharesAfterFirst = aliceVault.balanceOf(alice);

        _deposit(alice, aliceVault, 1000e6);
        uint256 sharesAfterSecond = aliceVault.balanceOf(alice);

        // Second deposit gets same rate as first (no yield accumulated)
        assertApproxEqRel(sharesAfterSecond, sharesAfterFirst * 2, 1e14); // 0.01% tolerance
        assertEq(aliceVault.totalAssets(), 2000e6);
    }

    function testRevert_Deposit_WhenPaused() public {
        vm.prank(alice);
        aliceVault.emergencyPause("test");

        vm.startPrank(alice);
        mockUSDC.approve(address(aliceVault), 1000e6);
        vm.expectRevert(UserVault.VaultPaused.selector);
        aliceVault.deposit(1000e6, alice);
        vm.stopPrank();
    }

    function testRevert_Mint_WhenPaused() public {
        vm.prank(alice);
        aliceVault.emergencyPause("test");

        vm.startPrank(alice);
        mockUSDC.approve(address(aliceVault), 1000e6);
        vm.expectRevert(UserVault.VaultPaused.selector);
        aliceVault.mint(1000e6, alice);
        vm.stopPrank();
    }

    // ── depositWithPermit ─────────────────────────────────────────────────────

    function test_DepositWithPermit_OneTransaction() public {
        uint256 amount = 1000e6;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = mockUSDC.nonces(alice);

        bytes32 structHash = keccak256(abi.encode(
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            alice,
            address(aliceVault),
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            mockUSDC.DOMAIN_SEPARATOR(),
            structHash
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, digest);

        vm.prank(alice);
        uint256 shares = aliceVault.depositWithPermit(amount, alice, deadline, v, r, s);

        assertGt(shares, 0);
        assertEq(aliceVault.balanceOf(alice), shares);
        assertEq(mockUSDC.balanceOf(address(aliceVault)), amount);
        // Nonce incremented — permit can't be replayed
        assertEq(mockUSDC.nonces(alice), nonce + 1);
    }

    function testRevert_DepositWithPermit_WhenPaused() public {
        vm.prank(alice);
        aliceVault.emergencyPause("paused");

        vm.prank(alice);
        vm.expectRevert(UserVault.VaultPaused.selector);
        aliceVault.depositWithPermit(1000e6, alice, block.timestamp + 1 hours, 0, bytes32(0), bytes32(0));
    }

    // ── depositNative ────────────────────────────────────────────────────────

    function test_DepositNative_WrapsAndSwaps() public {
        // Regular deposit first so totalSupply > 0 before native deposit
        _deposit(alice, aliceVault, 100e6);
        uint256 sharesBefore = aliceVault.balanceOf(alice);

        uint256 mntAmount = 2 ether; // 2 MNT at $0.50 = ~$0.997 USDC after 0.3% slippage
        vm.prank(alice);
        uint256 newShares = aliceVault.depositNative{value: mntAmount}(alice);

        assertGt(newShares, 0);
        assertEq(aliceVault.balanceOf(alice), sharesBefore + newShares);
        // 2 MNT → 997,000 USDC units (6 dec). Vault USDC: 100e6 + 997_000
        assertEq(mockUSDC.balanceOf(address(aliceVault)), 100e6 + 997_000);
    }

    function testRevert_DepositNative_ZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(UserVault.ZeroAmount.selector);
        aliceVault.depositNative{value: 0}(alice);
    }

    function testRevert_DepositNative_WhenPaused() public {
        vm.prank(alice);
        aliceVault.emergencyPause("paused");

        vm.prank(alice);
        vm.expectRevert(UserVault.VaultPaused.selector);
        aliceVault.depositNative{value: 1 ether}(alice);
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    function test_Withdraw_Full() public {
        uint256 amount = 1000e6;
        _deposit(alice, aliceVault, amount);

        vm.startPrank(alice);
        aliceVault.withdraw(amount, alice, alice);
        vm.stopPrank();

        assertEq(aliceVault.balanceOf(alice), 0);
        assertEq(aliceVault.totalAssets(), 0);
        assertEq(mockUSDC.balanceOf(alice), 100_000e6); // restored
    }

    function test_Withdraw_Partial() public {
        _deposit(alice, aliceVault, 1000e6);

        vm.startPrank(alice);
        aliceVault.withdraw(400e6, alice, alice);
        vm.stopPrank();

        assertEq(aliceVault.totalAssets(), 600e6);
        assertGt(aliceVault.balanceOf(alice), 0);
    }

    function test_Withdraw_DifferentReceiver() public {
        _deposit(alice, aliceVault, 1000e6);

        vm.startPrank(alice);
        aliceVault.withdraw(1000e6, bob, alice);
        vm.stopPrank();

        assertEq(aliceVault.totalAssets(), 0);
        assertEq(mockUSDC.balanceOf(bob), 100_000e6 + 1000e6);
    }

    function test_Withdraw_WorksWhenPaused() public {
        _deposit(alice, aliceVault, 1000e6);

        vm.prank(alice);
        aliceVault.emergencyPause("risk event");
        assertTrue(aliceVault.paused());

        // Withdraw still works — users can always exit
        vm.startPrank(alice);
        aliceVault.withdraw(1000e6, alice, alice);
        vm.stopPrank();

        assertEq(aliceVault.totalAssets(), 0);
        assertEq(mockUSDC.balanceOf(alice), 100_000e6);
    }

    function test_Redeem_WorksWhenPaused() public {
        uint256 shares = _deposit(alice, aliceVault, 1000e6);

        vm.prank(alice);
        aliceVault.emergencyPause("risk event");

        vm.startPrank(alice);
        aliceVault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(aliceVault.balanceOf(alice), 0);
    }

    // ── totalAssets ───────────────────────────────────────────────────────────

    function test_TotalAssets_PureUSDC() public {
        _deposit(alice, aliceVault, 1000e6);
        assertEq(aliceVault.totalAssets(), 1000e6);
    }

    function test_TotalAssets_NoDoubleCounting_USDC() public {
        // USDC must not be double-counted even though it may appear in allowedTokens loop
        _deposit(alice, aliceVault, 2000e6);
        assertEq(aliceVault.totalAssets(), 2000e6);
    }

    function test_TotalAssets_WithRWA_AfterRebalance() public {
        _deposit(alice, aliceVault, 5000e6);
        // Swap 2000 USDC → mUSD at $1.00/$1.00, 0.3% slippage → 1994 mUSD
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 2000e6, 1990 ether);

        // Vault: 3000 USDC + 1994 mUSD at $1.00 each ≈ 4994 USDC
        uint256 total = aliceVault.totalAssets();
        assertGt(total, 4900e6);
        assertLt(total, 5000e6);
    }

    function test_TotalAssets_MultipleRWA() public {
        _deposit(alice, aliceVault, 10_000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 2000e6, 1990 ether);
        _warpAndRefresh(2 hours);
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 4000e6, 1.99 ether);

        // ~4000 USDC + ~1994 mUSD + ~1.994 mETH at $2000 each
        uint256 total = aliceVault.totalAssets();
        assertGt(total, 9800e6);
        assertLt(total, 10_000e6);
    }

    // ── setRiskLevel ──────────────────────────────────────────────────────────

    function test_SetRiskLevel_Low() public {
        vm.prank(alice);
        aliceVault.setRiskLevel(UserVault.RiskLevel.MEDIUM); // change first
        vm.prank(alice);
        aliceVault.setRiskLevel(UserVault.RiskLevel.LOW);

        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.LOW));
    }

    function test_SetRiskLevel_Medium() public {
        vm.prank(alice);
        aliceVault.setRiskLevel(UserVault.RiskLevel.MEDIUM);
        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.MEDIUM));
    }

    function test_SetRiskLevel_High() public {
        vm.prank(alice);
        aliceVault.setRiskLevel(UserVault.RiskLevel.HIGH);
        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.HIGH));
    }

    function testRevert_SetRiskLevel_Custom_UseSetCustomAllocation() public {
        vm.prank(alice);
        vm.expectRevert(UserVault.InvalidAllocationSum.selector);
        aliceVault.setRiskLevel(UserVault.RiskLevel.CUSTOM);
    }

    function testRevert_SetRiskLevel_NotOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        aliceVault.setRiskLevel(UserVault.RiskLevel.MEDIUM);
    }

    // ── setCustomAllocation ───────────────────────────────────────────────────

    function test_SetCustomAllocation_50_30_20() public {
        vm.prank(alice);
        aliceVault.setCustomAllocation(5000, 3000, 2000);

        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.CUSTOM));
        (uint16 low, uint16 med, uint16 high) = aliceVault.customAllocation();
        assertEq(low, 5000);
        assertEq(med, 3000);
        assertEq(high, 2000);
    }

    function test_SetCustomAllocation_Equal() public {
        vm.prank(alice);
        aliceVault.setCustomAllocation(3334, 3333, 3333);
        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.CUSTOM));
    }

    function testRevert_SetCustomAllocation_SumNot10000() public {
        vm.prank(alice);
        vm.expectRevert(UserVault.InvalidAllocationSum.selector);
        aliceVault.setCustomAllocation(5000, 3000, 1000); // sums to 9000
    }

    function testRevert_SetCustomAllocation_Overflow() public {
        vm.prank(alice);
        vm.expectRevert(UserVault.InvalidAllocationSum.selector);
        aliceVault.setCustomAllocation(6000, 3000, 2000); // sums to 11000
    }

    function testRevert_SetCustomAllocation_NotOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        aliceVault.setCustomAllocation(5000, 3000, 2000);
    }

    // ── rebalance ─────────────────────────────────────────────────────────────

    function test_Rebalance_USDCToMUSD() public {
        _deposit(alice, aliceVault, 2000e6);

        uint256 usdcBefore = mockUSDC.balanceOf(address(aliceVault));
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 1000e6, 990 ether);

        assertLt(mockUSDC.balanceOf(address(aliceVault)), usdcBefore);
        assertGt(mockMUSD.balanceOf(address(aliceVault)), 990 ether);
    }

    function test_Rebalance_USDCToMETH() public {
        _deposit(alice, aliceVault, 4000e6);
        // $2000 USDC → ~0.997 mETH at $2000/mETH
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 2000e6, 0.99 ether);

        assertGt(mockMETH.balanceOf(address(aliceVault)), 0.99 ether);
    }

    function test_Rebalance_MultiStep_SingleTx() public {
        _deposit(alice, aliceVault, 5000e6);

        UserVault.SwapInstruction[] memory instructions = new UserVault.SwapInstruction[](2);
        instructions[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 1000e6, 990 ether);
        instructions[1] = UserVault.SwapInstruction(address(mockUSDC), address(mockMETH), 2000e6, 0.99 ether);

        vm.prank(agentExecutor);
        aliceVault.rebalance(instructions);

        assertGt(mockMUSD.balanceOf(address(aliceVault)), 990 ether);
        assertGt(mockMETH.balanceOf(address(aliceVault)), 0.99 ether);
        // Remaining USDC: 5000 - 1000 - 2000 = 2000
        assertEq(mockUSDC.balanceOf(address(aliceVault)), 2000e6);
    }

    function test_Rebalance_UpdatesLastRebalanceTime() public {
        _deposit(alice, aliceVault, 1000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 500e6, 490 ether);

        assertEq(aliceVault.lastRebalanceTime(), block.timestamp);
    }

    function test_Rebalance_LogsActivityInLog() public {
        _deposit(alice, aliceVault, 2000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 1000e6, 990 ether);

        assertEq(activityLog.totalActivities(), 1);

        AgentActivityLog.Activity[] memory acts =
            activityLog.getActivitiesByVault(address(aliceVault), 1);
        assertEq(acts[0].vault, address(aliceVault));
        assertEq(acts[0].action, "REBALANCE");
    }

    function test_Rebalance_AfterCooldown_Allowed() public {
        _deposit(alice, aliceVault, 3000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 500e6, 490 ether);

        _warpAndRefresh(1 hours + 1);

        // Second rebalance after cooldown succeeds
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 200e6, 198 ether);
        assertEq(activityLog.totalActivities(), 2);
    }

    function testRevert_Rebalance_NotAgent() public {
        _deposit(alice, aliceVault, 1000e6);

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 500e6, 0);

        vm.prank(alice);
        vm.expectRevert(UserVault.NotAuthorizedAgent.selector);
        aliceVault.rebalance(instr);
    }

    function testRevert_Rebalance_TooSoon() public {
        _deposit(alice, aliceVault, 2000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 500e6, 490 ether);

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 100e6, 0);

        vm.prank(agentExecutor);
        vm.expectRevert(UserVault.RebalanceTooSoon.selector);
        aliceVault.rebalance(instr);
    }

    function testRevert_Rebalance_TokenNotAllowed_TokenOut() public {
        _deposit(alice, aliceVault, 1000e6);

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), makeAddr("ghostToken"), 500e6, 0);

        vm.prank(agentExecutor);
        vm.expectRevert(UserVault.TokenNotAllowed.selector);
        aliceVault.rebalance(instr);
    }

    function testRevert_Rebalance_TokenNotAllowed_TokenIn() public {
        _deposit(alice, aliceVault, 1000e6);

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(makeAddr("ghostToken"), address(mockMUSD), 500e6, 0);

        vm.prank(agentExecutor);
        vm.expectRevert(UserVault.TokenNotAllowed.selector);
        aliceVault.rebalance(instr);
    }

    function testRevert_Rebalance_WhenPaused() public {
        _deposit(alice, aliceVault, 1000e6);
        vm.prank(alice);
        aliceVault.emergencyPause("attack");

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 500e6, 0);

        vm.prank(agentExecutor);
        vm.expectRevert(UserVault.VaultPaused.selector);
        aliceVault.rebalance(instr);
    }

    function testRevert_Rebalance_SlippageTooHigh() public {
        _deposit(alice, aliceVault, 2000e6);

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        // Ask for 2000 mUSD but only ~997 available — impossible minOut
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 1000e6, 2000 ether);

        vm.prank(agentExecutor);
        vm.expectRevert();
        aliceVault.rebalance(instr);
    }

    // ── USDC always allowed as tokenIn/tokenOut ───────────────────────────────

    function test_Rebalance_USDC_AsTokenIn_Always_Allowed() public {
        _deposit(alice, aliceVault, 2000e6);
        // USDC is the asset — not required to be in allowedTokens, always passes
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 1000e6, 990 ether);
        assertGt(mockMUSD.balanceOf(address(aliceVault)), 990 ether);
    }

    // ── emergencyPause ────────────────────────────────────────────────────────

    function test_EmergencyPause_ByOwner() public {
        vm.prank(alice);
        aliceVault.emergencyPause("risk event");
        assertTrue(aliceVault.paused());
    }

    function test_EmergencyPause_ByAgent() public {
        vm.prank(agentExecutor);
        aliceVault.emergencyPause("detected anomaly");
        assertTrue(aliceVault.paused());
    }

    function testRevert_EmergencyPause_Unauthorized() public {
        vm.prank(bob);
        vm.expectRevert("Not authorized");
        aliceVault.emergencyPause("attempt");
    }

    function test_EmergencyUnpause_ByOwner() public {
        vm.prank(alice);
        aliceVault.emergencyPause("paused");
        assertTrue(aliceVault.paused());

        vm.prank(alice);
        aliceVault.emergencyUnpause();
        assertFalse(aliceVault.paused());
    }

    function testRevert_EmergencyUnpause_NotOwner() public {
        vm.prank(alice);
        aliceVault.emergencyPause("paused");

        vm.prank(agentExecutor);
        vm.expectRevert();
        aliceVault.emergencyUnpause();
    }

    function testRevert_EmergencyUnpause_Unauthorized_Bob() public {
        vm.prank(alice);
        aliceVault.emergencyPause("paused");

        vm.prank(bob);
        vm.expectRevert();
        aliceVault.emergencyUnpause();
    }

    // ── setAgentExecutor ──────────────────────────────────────────────────────

    function test_SetAgentExecutor_Owner() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(alice);
        aliceVault.setAgentExecutor(newAgent);
        assertEq(aliceVault.agentExecutor(), newAgent);
    }

    function testRevert_SetAgentExecutor_NotOwner() public {
        vm.prank(bob);
        vm.expectRevert();
        aliceVault.setAgentExecutor(makeAddr("newAgent"));
    }

    // ── UUPS upgrade ─────────────────────────────────────────────────────────

    function testRevert_Upgrade_NotOwner() public {
        UserVault newImpl = new UserVault();
        vm.prank(bob);
        vm.expectRevert();
        aliceVault.upgradeToAndCall(address(newImpl), "");
    }

    function test_Upgrade_ByOwner_Allowed() public {
        UserVault newImpl = new UserVault();
        vm.prank(alice);
        aliceVault.upgradeToAndCall(address(newImpl), "");
        // No revert = success
    }

    function test_Upgrade_PreservesDeposits() public {
        uint256 amount = 1000e6;
        _deposit(alice, aliceVault, amount);
        uint256 sharesBefore = aliceVault.balanceOf(alice);

        UserVault newImpl = new UserVault();
        vm.prank(alice);
        aliceVault.upgradeToAndCall(address(newImpl), "");

        assertEq(aliceVault.balanceOf(alice), sharesBefore);
        assertEq(aliceVault.totalAssets(), amount);
        assertEq(aliceVault.owner(), alice);
        assertEq(aliceVault.agentExecutor(), agentExecutor);
    }

    function test_Upgrade_PreservesRiskPreference() public {
        vm.prank(alice);
        aliceVault.setCustomAllocation(6000, 3000, 1000);

        UserVault newImpl = new UserVault();
        vm.prank(alice);
        aliceVault.upgradeToAndCall(address(newImpl), "");

        assertEq(uint8(aliceVault.riskPreference()), uint8(UserVault.RiskLevel.CUSTOM));
        (uint16 low, uint16 med, uint16 high) = aliceVault.customAllocation();
        assertEq(low, 6000);
        assertEq(med, 3000);
        assertEq(high, 1000);
    }

    // ── Oracle integration ────────────────────────────────────────────────────

    function test_TotalAssets_OraclePriceRise_IncreasesValue() public {
        _deposit(alice, aliceVault, 2000e6);
        // ~0.4985 mETH at $2000 after 0.3% slippage
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 1000e6, 0.49 ether);

        uint256 totalBefore = aliceVault.totalAssets();

        // Oracle: mETH price doubles $2000 → $4000
        mockOracle.setPrice(FEED_METH, 4000e18);

        uint256 totalAfter = aliceVault.totalAssets();

        assertGt(totalAfter, totalBefore);
        // ~1000 USDC + 0.4985 mETH * $4000 ≈ $2994
        assertGt(totalAfter, 2800e6);
        assertLt(totalAfter, 3100e6);
    }

    function test_TotalAssets_StaleOracle_UsesLastKnownPrice() public {
        _deposit(alice, aliceVault, 2000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 1000e6, 0.49 ether);

        // Warp past maxStaleness (2 hours) without refreshing oracle
        vm.warp(block.timestamp + 3 hours);

        // totalAssets must NOT revert — uses getPriceUnsafe with last known price
        uint256 total = aliceVault.totalAssets();
        assertGt(total, 1800e6); // ~1000 USDC + ~0.4985 mETH * $2000 (stale price)
    }

    function test_Withdraw_StaleOracle_StillWorks() public {
        _deposit(alice, aliceVault, 2000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 1000e6, 0.49 ether);

        vm.warp(block.timestamp + 3 hours); // oracle stale

        // Withdraw the USDC still in vault — must NOT revert even with stale oracle
        uint256 usdcInVault = mockUSDC.balanceOf(address(aliceVault));
        vm.prank(alice);
        aliceVault.withdraw(usdcInVault, alice, alice);

        assertEq(mockUSDC.balanceOf(address(aliceVault)), 0);
    }

    // ── Rebalance to all RWA tokens ───────────────────────────────────────────

    function test_Rebalance_USDCToUSDY() public {
        _deposit(alice, aliceVault, 5000e6);
        // 2000 USDC → USDY at $1.05 → ~1904 USDY → after 0.3% slippage ~1899 USDY
        _rebalance(aliceVault, address(mockUSDC), address(mockUSDY), 2000e6, 1890 ether);

        assertGt(mockUSDY.balanceOf(address(aliceVault)), 1890 ether);
        assertLt(mockUSDY.balanceOf(address(aliceVault)), 1910 ether);
    }

    function test_Rebalance_USDCToCMETH() public {
        _deposit(alice, aliceVault, 5000e6);
        // 2100 USDC → cmETH at $2100 → 1 cmETH → after 0.3% slippage ~0.997 cmETH
        _rebalance(aliceVault, address(mockUSDC), address(mockCMETH), 2100e6, 0.99 ether);

        assertGt(mockCMETH.balanceOf(address(aliceVault)), 0.99 ether);
        assertLt(mockCMETH.balanceOf(address(aliceVault)), 1 ether);
    }

    function test_Rebalance_USDCToSUSDE() public {
        _deposit(alice, aliceVault, 5000e6);
        // 1080 USDC → sUSDe at $1.08 → 1000 sUSDe → after 0.3% slippage ~997 sUSDe
        _rebalance(aliceVault, address(mockUSDC), address(mockSUSDE), 1080e6, 990 ether);

        assertGt(mockSUSDE.balanceOf(address(aliceVault)), 990 ether);
        assertLt(mockSUSDE.balanceOf(address(aliceVault)), 1001 ether);
    }

    function test_Rebalance_USDCToWMNT() public {
        _deposit(alice, aliceVault, 5000e6);
        // 500 USDC → WMNT at $0.50 → 1000 WMNT → after 0.3% slippage ~997 WMNT
        _rebalance(aliceVault, address(mockUSDC), address(mockWMNT), 500e6, 990 ether);

        assertGt(mockWMNT.balanceOf(address(aliceVault)), 990 ether);
        assertLt(mockWMNT.balanceOf(address(aliceVault)), 1001 ether);
    }

    function test_TotalAssets_AllSixRWATokens() public {
        _deposit(alice, aliceVault, 20_000e6);

        // Single rebalance call with all 6 token swaps
        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](6);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD),  1000e6,  990 ether);
        instr[1] = UserVault.SwapInstruction(address(mockUSDC), address(mockUSDY),  1050e6,  940 ether);
        instr[2] = UserVault.SwapInstruction(address(mockUSDC), address(mockMETH),  4000e6, 1.98 ether);
        instr[3] = UserVault.SwapInstruction(address(mockUSDC), address(mockCMETH), 4200e6, 1.98 ether);
        instr[4] = UserVault.SwapInstruction(address(mockUSDC), address(mockSUSDE), 1080e6,  990 ether);
        instr[5] = UserVault.SwapInstruction(address(mockUSDC), address(mockWMNT),   500e6,  990 ether);

        vm.prank(agentExecutor, agentExecutor);
        aliceVault.rebalance(instr);

        // Total swapped: 1000+1050+4000+4200+1080+500 = 11830 USDC
        // Remaining: 8170 USDC + all 6 RWA positions
        // After 0.3% slippage, total ≈ 19965 USDC equivalent
        uint256 total = aliceVault.totalAssets();
        assertGt(total, 19_800e6);
        assertLt(total, 20_000e6);

        // All 6 RWA tokens have non-zero balance
        assertGt(mockMUSD.balanceOf(address(aliceVault)), 0);
        assertGt(mockUSDY.balanceOf(address(aliceVault)), 0);
        assertGt(mockMETH.balanceOf(address(aliceVault)), 0);
        assertGt(mockCMETH.balanceOf(address(aliceVault)), 0);
        assertGt(mockSUSDE.balanceOf(address(aliceVault)), 0);
        assertGt(mockWMNT.balanceOf(address(aliceVault)), 0);
    }
}
