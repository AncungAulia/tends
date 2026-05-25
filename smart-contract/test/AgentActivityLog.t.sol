// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {AgentActivityLog} from "../src/AgentActivityLog.sol";
import {UserVault} from "../src/UserVault.sol";

contract AgentActivityLogTest is BaseTest {
    UserVault aliceVault;

    function setUp() public override {
        super.setUp();
        aliceVault = _deployVaultFor(alice);
    }

    // ── Initialize ───────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(activityLog.owner(), owner);
        assertEq(activityLog.factory(), address(factory));
        assertEq(activityLog.totalActivities(), 0);
    }

    // ── logActivity ──────────────────────────────────────────────────────────

    function test_LogActivity_AuthorizedVault() public {
        // Alice's vault is authorized (factory auto-authorized it)
        _deposit(alice, aliceVault, 1000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 900e6, 890 ether);

        assertEq(activityLog.totalActivities(), 1);

        AgentActivityLog.Activity[] memory acts =
            activityLog.getActivitiesByVault(address(aliceVault), 1);

        assertEq(acts[0].vault, address(aliceVault));
        assertEq(acts[0].agent, agentExecutor);
        assertEq(acts[0].action, "REBALANCE");
        assertGt(acts[0].timestamp, 0);
    }

    function testRevert_LogActivity_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert(AgentActivityLog.NotAuthorized.selector);
        activityLog.logActivity(address(aliceVault), "REBALANCE", "");
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    function test_GetRecentActivities_NewestFirst() public {
        _deposit(alice, aliceVault, 5000e6);

        // First rebalance
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 1000e6, 990 ether);

        // Advance time and second rebalance
        _warpAndRefresh(2 hours);
        _rebalance(aliceVault, address(mockUSDC), address(mockMETH), 500e6, 0.24 ether);

        AgentActivityLog.Activity[] memory recent = activityLog.getRecentActivities(2);
        assertEq(recent.length, 2);
        // Most recent first
        assertGt(recent[0].timestamp, recent[1].timestamp);
    }

    function test_GetActivitiesByVault() public {
        UserVault bobVault = _deployVaultFor(bob);

        _deposit(alice, aliceVault, 2000e6);
        _deposit(bob,   bobVault,   2000e6);

        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 900e6, 890 ether);
        _warpAndRefresh(2 hours);
        _rebalance(bobVault, address(mockUSDC), address(mockMUSD), 900e6, 890 ether);

        AgentActivityLog.Activity[] memory aliceActs =
            activityLog.getActivitiesByVault(address(aliceVault), 10);
        AgentActivityLog.Activity[] memory bobActs =
            activityLog.getActivitiesByVault(address(bobVault), 10);

        assertEq(aliceActs.length, 1);
        assertEq(bobActs.length, 1);
        assertEq(aliceActs[0].vault, address(aliceVault));
        assertEq(bobActs[0].vault, address(bobVault));
    }

    function test_GetActivitiesByAgent() public {
        _deposit(alice, aliceVault, 2000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 900e6, 890 ether);

        AgentActivityLog.Activity[] memory agentActs =
            activityLog.getActivitiesByAgent(agentExecutor, 10);

        assertEq(agentActs.length, 1);
        assertEq(agentActs[0].agent, agentExecutor);
    }

    function test_GetRecentActivities_LimitRespected() public {
        _deposit(alice, aliceVault, 10_000e6);

        for (uint256 i = 0; i < 3; i++) {
            _warpAndRefresh(2 hours);
            _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 100e6, 99 ether);
        }

        AgentActivityLog.Activity[] memory recent = activityLog.getRecentActivities(2);
        assertEq(recent.length, 2);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function test_AuthorizeLogger_Owner() public {
        address newLogger = makeAddr("newLogger");
        vm.prank(owner);
        activityLog.authorizeLogger(newLogger, true);
        assertTrue(activityLog.authorizedLoggers(newLogger));
    }

    function test_AuthorizeLogger_Factory() public {
        // Factory is already set; verify it can authorize
        address newLogger = makeAddr("newLogger");
        vm.prank(address(factory));
        activityLog.authorizeLogger(newLogger, true);
        assertTrue(activityLog.authorizedLoggers(newLogger));
    }

    function testRevert_AuthorizeLogger_Unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Not authorized");
        activityLog.authorizeLogger(makeAddr("x"), true);
    }

    function test_SetFactory_Owner() public {
        address newFactory = makeAddr("newFactory");
        vm.prank(owner);
        activityLog.setFactory(newFactory);
        assertEq(activityLog.factory(), newFactory);
    }

    function testRevert_SetFactory_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        activityLog.setFactory(makeAddr("x"));
    }

    // ── UUPS upgrade ─────────────────────────────────────────────────────────

    function testRevert_Upgrade_NotOwner() public {
        AgentActivityLog newImpl = new AgentActivityLog();
        vm.prank(alice);
        vm.expectRevert();
        activityLog.upgradeToAndCall(address(newImpl), "");
    }

    function test_Upgrade_PreservesState() public {
        _deposit(alice, aliceVault, 1000e6);
        _rebalance(aliceVault, address(mockUSDC), address(mockMUSD), 900e6, 890 ether);

        uint256 totalBefore = activityLog.totalActivities();

        AgentActivityLog newImpl = new AgentActivityLog();
        vm.prank(owner);
        activityLog.upgradeToAndCall(address(newImpl), "");

        assertEq(activityLog.totalActivities(), totalBefore);
    }
}
