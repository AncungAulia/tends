// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {UserVault} from "../src/UserVault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

/// @notice Deploy new UserVault impl and upgrade deployer's own vault + update factory.
///         Only upgrades vaults where msg.sender == owner() — skips others gracefully.
///
///   forge script script/UpgradeDeployerVault.s.sol:UpgradeDeployerVaultScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract UpgradeDeployerVaultScript is Script {
    address constant FACTORY       = 0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400;
    address constant DEPLOYER_VAULT = 0xc6667F8aCd202EF42a34C68dC858761C53A8eD72;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy new UserVault impl (SC-1: setMinRebalanceInterval, SC-2: setAllowedToken)
        UserVault newImpl = new UserVault();
        console.log("New UserVault impl:", address(newImpl));

        // 2. Upgrade deployer's vault (deployer is owner, so _authorizeUpgrade passes)
        UUPSUpgradeable(DEPLOYER_VAULT).upgradeToAndCall(address(newImpl), "");
        console.log("Deployer vault upgraded:", DEPLOYER_VAULT);

        // 3. Update factory so new vaults use this impl
        VaultFactory(FACTORY).setImplementation(address(newImpl));
        console.log("Factory implementation updated to:", address(newImpl));

        vm.stopBroadcast();
    }
}
