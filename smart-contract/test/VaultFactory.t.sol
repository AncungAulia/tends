// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {BaseTest} from "./BaseTest.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {UserVault} from "../src/UserVault.sol";

contract VaultFactoryTest is BaseTest {
    // ── Initialize ───────────────────────────────────────────────────────────

    function test_Initialize() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.implementation(), address(vaultImpl));
        assertEq(factory.usdc(), address(mockUSDC));
        assertEq(factory.agentExecutor(), agentExecutor);
        assertEq(factory.strategyRouter(), address(strategyRouter));
        assertEq(factory.activityLog(), address(activityLog));
        assertEq(factory.priceFeed(), address(priceFeed));
        assertEq(factory.wmnt(), address(mockWMNT));
        assertEq(factory.totalVaults(), 0);
    }

    // ── deployVault ───────────────────────────────────────────────────────────

    function test_DeployVault_Alice() public {
        vm.prank(alice);
        address vault = factory.deployVault();

        assertEq(factory.vaultOf(alice), vault);
        assertEq(factory.totalVaults(), 1);
        assertEq(factory.allVaults(0), vault);
        assertTrue(vault != address(0));
    }

    function test_DeployVault_Bob() public {
        vm.prank(bob);
        address vault = factory.deployVault();

        assertEq(factory.vaultOf(bob), vault);
        assertEq(factory.totalVaults(), 1);
    }

    function test_DeployVault_MultipleUsers() public {
        vm.prank(alice);
        address aliceVaultAddr = factory.deployVault();

        vm.prank(bob);
        address bobVaultAddr = factory.deployVault();

        assertEq(factory.totalVaults(), 2);
        assertTrue(aliceVaultAddr != bobVaultAddr);
        assertEq(factory.vaultOf(alice), aliceVaultAddr);
        assertEq(factory.vaultOf(bob), bobVaultAddr);
        assertEq(factory.allVaults(0), aliceVaultAddr);
        assertEq(factory.allVaults(1), bobVaultAddr);
    }

    function testRevert_DeployVault_Duplicate() public {
        vm.prank(alice);
        factory.deployVault();

        vm.prank(alice);
        vm.expectRevert(VaultFactory.VaultAlreadyExists.selector);
        factory.deployVault();
    }

    function test_DeployVault_AutoAuthorizesInRouter() public {
        vm.prank(alice);
        address vault = factory.deployVault();

        assertTrue(strategyRouter.authorizedVaults(vault));
    }

    function test_DeployVault_AutoAuthorizesInActivityLog() public {
        vm.prank(alice);
        address vault = factory.deployVault();

        assertTrue(activityLog.authorizedLoggers(vault));
    }

    function test_DeployVault_InitializesOwnerCorrectly() public {
        vm.prank(alice);
        address vaultAddr = factory.deployVault();
        UserVault vault = UserVault(vaultAddr);

        assertEq(vault.owner(), alice);
    }

    function test_DeployVault_InitializesProtocolAddresses() public {
        vm.prank(alice);
        address vaultAddr = factory.deployVault();
        UserVault vault = UserVault(vaultAddr);

        assertEq(vault.agentExecutor(), agentExecutor);
        assertEq(vault.strategyRouter(), address(strategyRouter));
        assertEq(vault.activityLog(), address(activityLog));
        assertEq(vault.priceFeed(), address(priceFeed));
        assertEq(vault.wmnt(), address(mockWMNT));
        assertEq(vault.asset(), address(mockUSDC));
    }

    function test_DeployVault_Carol_ThirdUser() public {
        vm.prank(alice);
        factory.deployVault();
        vm.prank(bob);
        factory.deployVault();
        vm.prank(carol);
        address carolVault = factory.deployVault();

        assertEq(factory.totalVaults(), 3);
        assertEq(factory.vaultOf(carol), carolVault);
        assertEq(factory.allVaults(2), carolVault);
    }

    function test_DeployVault_EmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit VaultFactory.VaultDeployed(alice, address(0)); // check indexed `user`
        factory.deployVault();
    }

    // ── setImplementation ────────────────────────────────────────────────────

    function test_SetImplementation() public {
        UserVault newImpl = new UserVault();
        address oldImpl = factory.implementation();

        vm.prank(owner);
        factory.setImplementation(address(newImpl));

        assertEq(factory.implementation(), address(newImpl));
        assertTrue(factory.implementation() != oldImpl);
    }

    function testRevert_SetImplementation_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setImplementation(makeAddr("impl"));
    }

    function testRevert_SetImplementation_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(VaultFactory.ZeroAddress.selector);
        factory.setImplementation(address(0));
    }

    // ── UUPS upgrade ─────────────────────────────────────────────────────────

    function testRevert_Upgrade_NotOwner() public {
        VaultFactory newImpl = new VaultFactory();
        vm.prank(alice);
        vm.expectRevert();
        factory.upgradeToAndCall(address(newImpl), "");
    }

    function test_Upgrade_PreservesState() public {
        vm.prank(alice);
        address aliceVaultAddr = factory.deployVault();
        vm.prank(bob);
        factory.deployVault();

        VaultFactory newImpl = new VaultFactory();
        vm.prank(owner);
        factory.upgradeToAndCall(address(newImpl), "");

        assertEq(factory.owner(), owner);
        assertEq(factory.totalVaults(), 2);
        assertEq(factory.vaultOf(alice), aliceVaultAddr);
        assertEq(factory.usdc(), address(mockUSDC));
        assertEq(factory.agentExecutor(), agentExecutor);
    }
}
