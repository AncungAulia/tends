// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

interface IVaultFactory {
    function totalVaults() external view returns (uint256);
    function allVaults(uint256 index) external view returns (address);
}

interface IUserVault {
    function addAllowedTokens(address[] calldata tokens) external;
    function isAllowedToken(address token) external view returns (bool);
    function owner() external view returns (address);
}

/// @notice Add all 42 RWA tokens directly to each vault as the deployer (owner).
///
///   forge script script/AddTokensToAllVaults.s.sol:AddTokensToAllVaultsScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract AddTokensToAllVaultsScript is Script {
    function run() external {
        uint256 pk      = vm.envUint("PRIVATE_KEY");
        address factory = vm.envAddress("VAULT_FACTORY_ADDRESS");

        // Build full token list (all non-USDC tokens)
        address[] memory tokens = _buildTokenList();

        vm.startBroadcast(pk);

        IVaultFactory vf = IVaultFactory(factory);
        uint256 total = vf.totalVaults();
        console.log("Total vaults:", total);

        for (uint256 i = 0; i < total; i++) {
            address vault = vf.allVaults(i);
            console.log("Adding tokens to vault:", vault);
            IUserVault(vault).addAllowedTokens(tokens);
        }

        vm.stopBroadcast();

        console.log("=== All vaults updated ===");
        console.log("Tokens registered per vault:", tokens.length);
    }

    function _buildTokenList() internal view returns (address[] memory) {
        address[] memory t = new address[](42); // all except USDC
        uint256 i = 0;

        // Core mocks (excluding USDC which is the vault asset)
        t[i++] = vm.envAddress("MUSD_ADDRESS");
        t[i++] = vm.envAddress("USDY_ADDRESS");
        t[i++] = vm.envAddress("METH_ADDRESS");
        t[i++] = vm.envAddress("CMETH_ADDRESS");
        t[i++] = vm.envAddress("SUSDE_ADDRESS");
        t[i++] = vm.envAddress("WMNT_ADDRESS");

        // Bonds
        t[i++] = vm.envAddress("CETES_ADDRESS");
        t[i++] = vm.envAddress("GILTS_ADDRESS");
        t[i++] = vm.envAddress("KTB_ADDRESS");
        t[i++] = vm.envAddress("TESOURO_ADDRESS");

        // Funds / RWA
        t[i++] = vm.envAddress("ACRED_ADDRESS");
        t[i++] = vm.envAddress("BENJI_ADDRESS");
        t[i++] = vm.envAddress("BUIDL_ADDRESS");
        t[i++] = vm.envAddress("ONDO_ADDRESS");
        t[i++] = vm.envAddress("VBILL_ADDRESS");

        // Commodities
        t[i++] = vm.envAddress("URANIUM_ADDRESS");
        t[i++] = vm.envAddress("WTI_ADDRESS");
        t[i++] = vm.envAddress("XAG_ADDRESS");
        t[i++] = vm.envAddress("XAU_ADDRESS");
        t[i++] = vm.envAddress("XAUT_ADDRESS");
        t[i++] = vm.envAddress("XCU_ADDRESS");
        t[i++] = vm.envAddress("XPT_ADDRESS");

        // Indices
        t[i++] = vm.envAddress("KOSPI200_ADDRESS");
        t[i++] = vm.envAddress("NIKKEI225_ADDRESS");
        t[i++] = vm.envAddress("USA100_ADDRESS");
        t[i++] = vm.envAddress("USA500_ADDRESS");

        // Stocks
        t[i++] = vm.envAddress("AAPL_ADDRESS");
        t[i++] = vm.envAddress("AMZN_ADDRESS");
        t[i++] = vm.envAddress("GOOGL_ADDRESS");
        t[i++] = vm.envAddress("META_ADDRESS");
        t[i++] = vm.envAddress("MSFT_ADDRESS");
        t[i++] = vm.envAddress("NVDA_ADDRESS");
        t[i++] = vm.envAddress("PLTR_ADDRESS");
        t[i++] = vm.envAddress("TSLA_ADDRESS");

        // FX
        t[i++] = vm.envAddress("BRL_ADDRESS");
        t[i++] = vm.envAddress("EUR_ADDRESS");
        t[i++] = vm.envAddress("GBP_ADDRESS");
        t[i++] = vm.envAddress("IDR_ADDRESS");
        t[i++] = vm.envAddress("JPY_ADDRESS");
        t[i++] = vm.envAddress("KRW_ADDRESS");
        t[i++] = vm.envAddress("SGD_ADDRESS");
        t[i++] = vm.envAddress("TRY_ADDRESS");

        return t;
    }
}
