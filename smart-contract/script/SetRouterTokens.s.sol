// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

interface IStrategyRouter {
    function setAllowedTokens(address[] calldata tokens, bool allowed) external;
    function allowedTokens(address token) external view returns (bool);
}

/// @notice Register all 43 tokens (USDC + 42 RWA/mock) on StrategyRouter.
///         Run this once after AddTokensToAllVaults — the router allowlist was
///         seeded with only the initial 7 tokens at deploy time.
///
///   forge script script/SetRouterTokens.s.sol:SetRouterTokensScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract SetRouterTokensScript is Script {
    function run() external {
        uint256 pk     = vm.envUint("PRIVATE_KEY");
        address router = vm.envAddress("STRATEGY_ROUTER_ADDRESS");

        address[] memory tokens = new address[](43);
        uint256 i = 0;

        // Core (already set at deploy — idempotent to re-set)
        tokens[i++] = vm.envAddress("USDC_ADDRESS");
        tokens[i++] = vm.envAddress("MUSD_ADDRESS");
        tokens[i++] = vm.envAddress("USDY_ADDRESS");
        tokens[i++] = vm.envAddress("METH_ADDRESS");
        tokens[i++] = vm.envAddress("CMETH_ADDRESS");
        tokens[i++] = vm.envAddress("SUSDE_ADDRESS");
        tokens[i++] = vm.envAddress("WMNT_ADDRESS");

        // Bonds
        tokens[i++] = vm.envAddress("CETES_ADDRESS");
        tokens[i++] = vm.envAddress("GILTS_ADDRESS");
        tokens[i++] = vm.envAddress("KTB_ADDRESS");
        tokens[i++] = vm.envAddress("TESOURO_ADDRESS");

        // Funds / RWA
        tokens[i++] = vm.envAddress("ACRED_ADDRESS");
        tokens[i++] = vm.envAddress("BENJI_ADDRESS");
        tokens[i++] = vm.envAddress("BUIDL_ADDRESS");
        tokens[i++] = vm.envAddress("ONDO_ADDRESS");
        tokens[i++] = vm.envAddress("VBILL_ADDRESS");

        // Commodities
        tokens[i++] = vm.envAddress("URANIUM_ADDRESS");
        tokens[i++] = vm.envAddress("WTI_ADDRESS");
        tokens[i++] = vm.envAddress("XAG_ADDRESS");
        tokens[i++] = vm.envAddress("XAU_ADDRESS");
        tokens[i++] = vm.envAddress("XAUT_ADDRESS");
        tokens[i++] = vm.envAddress("XCU_ADDRESS");
        tokens[i++] = vm.envAddress("XPT_ADDRESS");

        // Indices
        tokens[i++] = vm.envAddress("KOSPI200_ADDRESS");
        tokens[i++] = vm.envAddress("NIKKEI225_ADDRESS");
        tokens[i++] = vm.envAddress("USA100_ADDRESS");
        tokens[i++] = vm.envAddress("USA500_ADDRESS");

        // Stocks
        tokens[i++] = vm.envAddress("AAPL_ADDRESS");
        tokens[i++] = vm.envAddress("AMZN_ADDRESS");
        tokens[i++] = vm.envAddress("GOOGL_ADDRESS");
        tokens[i++] = vm.envAddress("META_ADDRESS");
        tokens[i++] = vm.envAddress("MSFT_ADDRESS");
        tokens[i++] = vm.envAddress("NVDA_ADDRESS");
        tokens[i++] = vm.envAddress("PLTR_ADDRESS");
        tokens[i++] = vm.envAddress("TSLA_ADDRESS");

        // FX
        tokens[i++] = vm.envAddress("BRL_ADDRESS");
        tokens[i++] = vm.envAddress("EUR_ADDRESS");
        tokens[i++] = vm.envAddress("GBP_ADDRESS");
        tokens[i++] = vm.envAddress("IDR_ADDRESS");
        tokens[i++] = vm.envAddress("JPY_ADDRESS");
        tokens[i++] = vm.envAddress("KRW_ADDRESS");
        tokens[i++] = vm.envAddress("SGD_ADDRESS");
        tokens[i++] = vm.envAddress("TRY_ADDRESS");

        vm.startBroadcast(pk);
        IStrategyRouter(router).setAllowedTokens(tokens, true);
        vm.stopBroadcast();

        console.log("=== StrategyRouter tokens registered ===");
        console.log("Router  :", router);
        console.log("Tokens  :", i);

        // Spot-check a few
        console.log("USDC allowed  :", IStrategyRouter(router).allowedTokens(tokens[0]));
        console.log("GILTS allowed :", IStrategyRouter(router).allowedTokens(tokens[8]));
        console.log("AAPL allowed  :", IStrategyRouter(router).allowedTokens(tokens[28]));
    }
}
