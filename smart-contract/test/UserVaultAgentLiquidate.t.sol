// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {UserVault} from "../src/UserVault.sol";

/// @notice Tests for agentLiquidate() + withdraw flow.
///
/// Root cause being tested:
///   UserVault.withdraw() only moves USDC. When the vault holds non-USDC
///   RWA tokens, a direct withdraw() reverts (USDC shortfall).
///   The fix: agent calls agentLiquidate() first to sell all non-USDC
///   holdings, then returns a withdraw tx for the user to sign.
///
/// Two withdrawal cases:
///   Case A — MAX withdraw: all USDC after liquidation
///   Case B — Partial:  10%, 59%, or a fixed amount like $471
contract UserVaultAgentLiquidateTest is BaseTest {
    // Each test deploys its own vault for a fresh address so there are
    // no VaultAlreadyExists conflicts with alice/bob from BaseTest.
    address internal user;
    UserVault internal vault;

    function setUp() public override {
        super.setUp();
        user = makeAddr("liquidateUser");
        mockUSDC.mint(user, 100_000e6);
        vm.prank(user);
        vault = UserVault(factory.deployVault());
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function _agentLiquidate() internal {
        vm.prank(agentExecutor);
        vault.agentLiquidate();
    }

    /// @dev Deposit and rebalance into 3 positions + cash:
    ///   300 USDC → mUSD | 400 USDC → mETH | 200 USDC → USDY | 100 USDC cash
    function _loadMultiAsset(uint256 totalDeposit) internal {
        vm.startPrank(user);
        mockUSDC.approve(address(vault), totalDeposit);
        vault.deposit(totalDeposit, user);
        vm.stopPrank();

        // scale positions proportionally to deposit
        uint256 base = totalDeposit;
        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](3);
        instr[0] = UserVault.SwapInstruction(
            address(mockUSDC), address(mockMUSD),
            base * 30 / 100, // 30% → mUSD
            (base * 30 / 100) * 97 / 100 * 1 ether / 1e6 // ~97% of value in mUSD (18 dec)
        );
        instr[1] = UserVault.SwapInstruction(
            address(mockUSDC), address(mockMETH),
            base * 40 / 100, // 40% → mETH
            (base * 40 / 100) * 97 / 100 * 1 ether / (2000 * 1e6) // ~97% of value in mETH
        );
        instr[2] = UserVault.SwapInstruction(
            address(mockUSDC), address(mockUSDY),
            base * 20 / 100, // 20% → USDY
            (base * 20 / 100) * 97 / 100 * 1 ether / (105 * 1e4) // ~97% of value in USDY (at $1.05)
        );
        vm.prank(agentExecutor, agentExecutor);
        vault.rebalance(instr);
    }

    // ── Access control ─────────────────────────────────────────────────────────

    function testRevert_AgentLiquidate_NotAgent_Owner() public {
        _loadMultiAsset(1000e6);
        vm.prank(user);
        vm.expectRevert(UserVault.NotAuthorizedAgent.selector);
        vault.agentLiquidate();
    }

    function testRevert_AgentLiquidate_NotAgent_RandomAddress() public {
        _loadMultiAsset(1000e6);
        vm.prank(makeAddr("random"));
        vm.expectRevert(UserVault.NotAuthorizedAgent.selector);
        vault.agentLiquidate();
    }

    // ── Liquidation correctness ────────────────────────────────────────────────

    function test_AgentLiquidate_ClearsAllRWAPositions() public {
        _loadMultiAsset(1000e6);

        assertGt(mockMUSD.balanceOf(address(vault)), 0, "mUSD pre");
        assertGt(mockMETH.balanceOf(address(vault)), 0, "mETH pre");
        assertGt(mockUSDY.balanceOf(address(vault)), 0, "USDY pre");

        _agentLiquidate();

        assertEq(mockMUSD.balanceOf(address(vault)), 0, "mUSD post");
        assertEq(mockMETH.balanceOf(address(vault)), 0, "mETH post");
        assertEq(mockUSDY.balanceOf(address(vault)), 0, "USDY post");
    }

    function test_AgentLiquidate_USDCBalanceNearOriginal() public {
        // Vault invests 900/1000 USDC. Each position takes 0.3% slippage
        // on buy AND on sell → ~0.6% loss on invested portion.
        // 900 USDC invested → ~894.6 USDC returned. + 100 cash = ~994.6 USDC.
        _loadMultiAsset(1000e6);
        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        assertGt(usdcBal, 990e6, "USDC too low");
        assertLt(usdcBal, 1000e6, "must have some slippage loss");
    }

    function test_AgentLiquidate_PureUSDC_NoOp() public {
        // Vault has only USDC — agentLiquidate should be a silent no-op.
        vm.startPrank(user);
        mockUSDC.approve(address(vault), 1000e6);
        vault.deposit(1000e6, user);
        vm.stopPrank();

        _agentLiquidate();

        assertEq(mockUSDC.balanceOf(address(vault)), 1000e6, "USDC unchanged");
    }

    // ── lastRebalanceTime must NOT be updated ──────────────────────────────────

    function test_AgentLiquidate_DoesNotUpdateLastRebalanceTime() public {
        _loadMultiAsset(1000e6);
        uint256 tsAfterRebalance = vault.lastRebalanceTime();

        _warpAndRefresh(30 minutes); // not past cooldown yet
        _agentLiquidate();

        assertEq(vault.lastRebalanceTime(), tsAfterRebalance, "lastRebalanceTime must not change");
    }

    function test_AgentLiquidate_CooldownStillBlocksRebalanceAfter() public {
        // The rebalance cooldown from _loadMultiAsset must survive a liquidation.
        _loadMultiAsset(1000e6);
        _agentLiquidate();

        // Deposit fresh USDC so there is something to rebalance
        vm.startPrank(user);
        mockUSDC.approve(address(vault), 200e6);
        vault.deposit(200e6, user);
        vm.stopPrank();

        // Immediate rebalance → RebalanceTooSoon
        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 100e6, 97 ether);
        vm.prank(agentExecutor);
        vm.expectRevert(UserVault.RebalanceTooSoon.selector);
        vault.rebalance(instr);

        // After cooldown it works
        _warpAndRefresh(1 hours + 1);
        _rebalance(vault, address(mockUSDC), address(mockMUSD), 100e6, 97 ether);
    }

    // ── Oracle / slippage gap ─────────────────────────────────────────────────

    function test_AgentLiquidate_OracleGap_USDCLessThanTotalAssets() public {
        // totalAssets() uses oracle prices (no slippage).
        // agentLiquidate sells with 0.3% × 2 (buy + sell) loss.
        // → actual USDC post-liquidation < oracle-based totalAssets.
        _loadMultiAsset(1000e6);
        uint256 oracleValue = vault.totalAssets();

        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        assertLt(usdcBal, oracleValue, "slippage gap must exist");
    }

    // ── Case A: MAX withdraw ───────────────────────────────────────────────────

    function test_CaseA_AgentLiquidate_WithdrawMax_ThreeTokenVault() public {
        _loadMultiAsset(1000e6);
        uint256 userBalBefore = mockUSDC.balanceOf(user);

        _agentLiquidate();
        uint256 usdcBal = mockUSDC.balanceOf(address(vault));

        // Withdraw the actual USDC balance (backend pattern: safeAmount = usdcBal * 0.999)
        vm.prank(user);
        vault.withdraw(usdcBal, user, user);

        assertEq(mockUSDC.balanceOf(address(vault)), 0, "vault empty");
        assertEq(vault.totalSupply(), 0, "all shares burned");
        assertEq(mockUSDC.balanceOf(user), userBalBefore + usdcBal, "user received all");
    }

    function test_CaseA_AgentLiquidate_WithdrawMax_943USDC_GuideScenario() public {
        // Mirrors the testnet vault scenario from WITHDRAW_WIRING.md:
        // mUSD $398 · mETH $445 · USDY $99 (USDC = $0)
        vm.startPrank(user);
        mockUSDC.approve(address(vault), 943e6);
        vault.deposit(943e6, user);
        vm.stopPrank();

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](3);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 398e6, 390 ether);
        instr[1] = UserVault.SwapInstruction(address(mockUSDC), address(mockMETH), 445e6, 0.22 ether);
        instr[2] = UserVault.SwapInstruction(address(mockUSDC), address(mockUSDY), 99e6,  92 ether);
        vm.prank(agentExecutor, agentExecutor);
        vault.rebalance(instr);

        // Pre-liquidation: no USDC in vault (all invested)
        assertEq(mockUSDC.balanceOf(address(vault)), 1e6, "1 USDC cash (943-398-445-99=1)");

        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        // Expected: ~943 * (1 - 0.006) ≈ 937 USDC minimum (two-leg slippage)
        assertGt(usdcBal, 930e6, "should recover most of $943");
        assertLt(usdcBal, 943e6, "must be less than original due to slippage");

        // MAX withdraw using actual balance
        uint256 userBalBefore = mockUSDC.balanceOf(user);
        vm.prank(user);
        vault.withdraw(usdcBal, user, user);

        assertEq(mockUSDC.balanceOf(address(vault)), 0, "vault empty");
        assertEq(mockUSDC.balanceOf(user), userBalBefore + usdcBal, "user received all");
    }

    function test_CaseA_AgentLiquidate_WithdrawMax_AllSixTokens() public {
        vm.startPrank(user);
        mockUSDC.approve(address(vault), 20_000e6);
        vault.deposit(20_000e6, user);
        vm.stopPrank();

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](6);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD),  1000e6,  990 ether);
        instr[1] = UserVault.SwapInstruction(address(mockUSDC), address(mockUSDY),  1050e6,  940 ether);
        instr[2] = UserVault.SwapInstruction(address(mockUSDC), address(mockMETH),  4000e6, 1.98 ether);
        instr[3] = UserVault.SwapInstruction(address(mockUSDC), address(mockCMETH), 4200e6, 1.98 ether);
        instr[4] = UserVault.SwapInstruction(address(mockUSDC), address(mockSUSDE), 1080e6,  990 ether);
        instr[5] = UserVault.SwapInstruction(address(mockUSDC), address(mockWMNT),   500e6,  990 ether);
        vm.prank(agentExecutor, agentExecutor);
        vault.rebalance(instr);

        _agentLiquidate();

        // All 6 RWA cleared
        assertEq(mockMUSD.balanceOf(address(vault)),  0);
        assertEq(mockUSDY.balanceOf(address(vault)),  0);
        assertEq(mockMETH.balanceOf(address(vault)),  0);
        assertEq(mockCMETH.balanceOf(address(vault)), 0);
        assertEq(mockSUSDE.balanceOf(address(vault)), 0);
        assertEq(mockWMNT.balanceOf(address(vault)),  0);

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        // 11830 USDC invested, 8170 USDC cash; at 0.6% round-trip loss on invested:
        // 11830 * 0.994 + 8170 ≈ 19_928 USDC
        assertGt(usdcBal, 19_700e6, "less than 1.5% slippage loss");
        assertLt(usdcBal, 20_000e6);

        uint256 userBalBefore = mockUSDC.balanceOf(user);
        vm.prank(user);
        vault.withdraw(usdcBal, user, user);

        assertEq(mockUSDC.balanceOf(address(vault)), 0, "vault empty");
        assertEq(mockUSDC.balanceOf(user), userBalBefore + usdcBal);
    }

    // ── Case B: Partial withdrawals ────────────────────────────────────────────

    function test_CaseB_AgentLiquidate_WithdrawPartial_10Pct() public {
        _loadMultiAsset(1000e6);
        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        uint256 withdrawAmt = usdcBal * 10 / 100; // 10%
        uint256 userBalBefore = mockUSDC.balanceOf(user);

        vm.prank(user);
        vault.withdraw(withdrawAmt, user, user);

        assertEq(mockUSDC.balanceOf(user), userBalBefore + withdrawAmt, "received 10%");
        assertApproxEqAbs(mockUSDC.balanceOf(address(vault)), usdcBal - withdrawAmt, 1, "90% remains");
        assertGt(vault.totalSupply(), 0, "shares remain");
    }

    function test_CaseB_AgentLiquidate_WithdrawPartial_59Pct() public {
        _loadMultiAsset(1000e6);
        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        uint256 withdrawAmt = usdcBal * 59 / 100; // 59%
        uint256 userBalBefore = mockUSDC.balanceOf(user);

        vm.prank(user);
        vault.withdraw(withdrawAmt, user, user);

        assertEq(mockUSDC.balanceOf(user), userBalBefore + withdrawAmt, "received 59%");
        assertApproxEqAbs(mockUSDC.balanceOf(address(vault)), usdcBal - withdrawAmt, 1, "41% remains");
        assertGt(vault.totalSupply(), 0, "shares remain");
    }

    function test_CaseB_AgentLiquidate_WithdrawPartial_471USDC_GuideScenario() public {
        // $471 = 50% of $943 vault from WITHDRAW_WIRING.md
        vm.startPrank(user);
        mockUSDC.approve(address(vault), 943e6);
        vault.deposit(943e6, user);
        vm.stopPrank();

        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](3);
        instr[0] = UserVault.SwapInstruction(address(mockUSDC), address(mockMUSD), 398e6, 390 ether);
        instr[1] = UserVault.SwapInstruction(address(mockUSDC), address(mockMETH), 445e6, 0.22 ether);
        instr[2] = UserVault.SwapInstruction(address(mockUSDC), address(mockUSDY), 99e6,  92 ether);
        vm.prank(agentExecutor, agentExecutor);
        vault.rebalance(instr);

        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        assertGt(usdcBal, 471e6, "must have enough USDC for $471 withdraw");

        uint256 userBalBefore = mockUSDC.balanceOf(user);
        vm.prank(user);
        vault.withdraw(471e6, user, user); // withdraw exactly $471

        assertEq(mockUSDC.balanceOf(user), userBalBefore + 471e6, "received $471");
        assertEq(mockUSDC.balanceOf(address(vault)), usdcBal - 471e6, "remainder in vault");
        assertGt(vault.totalSupply(), 0, "shares remain");
    }

    function test_CaseB_AgentLiquidate_MultiplePartialWithdraws() public {
        // Prove user can do incremental withdrawals after one liquidation
        _loadMultiAsset(1000e6);
        _agentLiquidate();

        uint256 usdcBal = mockUSDC.balanceOf(address(vault));
        uint256 chunk = usdcBal / 4; // 25% each time

        vm.startPrank(user);
        vault.withdraw(chunk, user, user); // 1st: 25%
        vault.withdraw(chunk, user, user); // 2nd: 50% cumulative
        vault.withdraw(chunk, user, user); // 3rd: 75% cumulative
        vm.stopPrank();

        // ~25% of usdcBal still in vault (±1 rounding)
        assertApproxEqAbs(mockUSDC.balanceOf(address(vault)), usdcBal - chunk * 3, 3);
        assertGt(vault.totalSupply(), 0, "shares remain after 3 partial withdraws");
    }

    // ── Without agentLiquidate: direct withdraw fails ─────────────────────────

    function testRevert_WithdrawWithoutLiquidation_Fails() public {
        // Documents the root cause: withdraw() with non-USDC holdings reverts
        // because there is no USDC to transfer.
        _loadMultiAsset(1000e6);

        uint256 usdcInVault = mockUSDC.balanceOf(address(vault));
        uint256 totalVal    = vault.totalAssets(); // oracle-based, ~1000e6

        // Withdraw any amount > the USDC actually in vault → revert
        uint256 withdrawAttempt = usdcInVault + 1;
        vm.prank(user);
        vm.expectRevert(); // ERC4626ExceededMaxWithdraw or SafeERC20 transfer failure
        vault.withdraw(withdrawAttempt, user, user);

        // Confirm: trying to withdraw totalAssets (oracle) while only having 100 USDC cash
        assertLt(usdcInVault, totalVal, "USDC in vault < oracle totalAssets");
    }
}
