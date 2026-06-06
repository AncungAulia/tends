// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {UserVault} from "../src/UserVault.sol";
import {VaultFactory} from "../src/VaultFactory.sol";

/// @notice Deploy new implementations and upgrade proxies.
///         Token allowlist is pushed separately by the backend (agentExecutor)
///         via VaultFactory.batchAddTokensToVaults() or UserVault.addAllowedTokens().
///
///   forge script script/UpgradeAllVaults.s.sol:UpgradeAllVaultsScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract UpgradeAllVaultsScript is Script {
    address constant FACTORY  = 0x279B31B00F64C0ce85BCe2Bd7e377CdcAE58d400;
    address constant DEPLOYER = 0x56A2950ddE6B1040d1DCC4b4C4Fc314Bd56eFB0E;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy new UserVault impl (addAllowedTokens + relaxed _authorizeUpgrade)
        UserVault newVaultImpl = new UserVault();
        console.log("New UserVault impl:", address(newVaultImpl));

        // 2. Deploy new VaultFactory impl (addAllowedTokens + batchAddTokensToVaults)
        VaultFactory newFactoryImpl = new VaultFactory();
        console.log("New VaultFactory impl:", address(newFactoryImpl));

        // 3. Upgrade VaultFactory proxy to new impl
        UUPSUpgradeable(FACTORY).upgradeToAndCall(address(newFactoryImpl), "");
        console.log("VaultFactory proxy upgraded");

        // 4. Upgrade deployer's vault proxy to new UserVault impl
        //    (old impl is onlyOwner — only the vault owner can do this)
        VaultFactory factory = VaultFactory(FACTORY);
        address deployerVault = factory.vaultOf(DEPLOYER);
        if (deployerVault != address(0)) {
            UUPSUpgradeable(deployerVault).upgradeToAndCall(address(newVaultImpl), "");
            console.log("Deployer vault upgraded:", deployerVault);
        } else {
            console.log("Deployer has no vault - skip vault upgrade");
        }

        // 5. Point factory at new UserVault impl for future deployVault() calls
        factory.setImplementation(address(newVaultImpl));
        console.log("Factory.implementation updated");

        console.log("totalVaults:", factory.totalVaults());
        console.log("=== Done. Run backend setup-vault-tokens to register all tokens. ===");

        vm.stopBroadcast();
    }
}
