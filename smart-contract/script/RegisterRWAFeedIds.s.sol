// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {PriceFeed} from "../src/PriceFeed.sol";

/// @notice Registers feedIds for all RWA mock tokens in PriceFeed.
/// @dev Prerequisites:
///   1. All RWA mock tokens deployed (DeployRWAMocks.s.sol)
///   2. PriceFeed deployed (DeployCore.s.sol)
///   3. PRICE_FEED_ADDRESS, all RWA token addresses set in .env
///
///   forge script script/RegisterRWAFeedIds.s.sol:RegisterRWAFeedIdsScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract RegisterRWAFeedIdsScript is Script {
    function run() external {
        address priceFeed = vm.envAddress("PRICE_FEED_ADDRESS");
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // ── Token addresses from .env ────────────────────────────────────────
        address[] memory tokens = new address[](36);
        bytes32[] memory feedIds = new bytes32[](36);

        uint256 i = 0;

        // Bonds
        tokens[i] = vm.envAddress("CETES_ADDRESS");   feedIds[i] = bytes32("CETES");   i++;
        tokens[i] = vm.envAddress("GILTS_ADDRESS");   feedIds[i] = bytes32("GILTS");   i++;
        tokens[i] = vm.envAddress("KTB_ADDRESS");     feedIds[i] = bytes32("KTB");     i++;
        tokens[i] = vm.envAddress("TESOURO_ADDRESS"); feedIds[i] = bytes32("TESOURO"); i++;

        // Commodities
        tokens[i] = vm.envAddress("URANIUM_ADDRESS"); feedIds[i] = bytes32("URANIUM"); i++;
        tokens[i] = vm.envAddress("WTI_ADDRESS");     feedIds[i] = bytes32("WTI");     i++;
        tokens[i] = vm.envAddress("XAG_ADDRESS");     feedIds[i] = bytes32("XAG");     i++;
        tokens[i] = vm.envAddress("XAU_ADDRESS");     feedIds[i] = bytes32("XAU");     i++;
        tokens[i] = vm.envAddress("XAUT_ADDRESS");    feedIds[i] = bytes32("XAUt");    i++;
        tokens[i] = vm.envAddress("XCU_ADDRESS");     feedIds[i] = bytes32("XCU");     i++;
        tokens[i] = vm.envAddress("XPT_ADDRESS");     feedIds[i] = bytes32("XPT");     i++;

        // Funds
        tokens[i] = vm.envAddress("ACRED_ADDRESS");   feedIds[i] = bytes32("ACRED");   i++;
        tokens[i] = vm.envAddress("BENJI_ADDRESS");   feedIds[i] = bytes32("BENJI");   i++;
        tokens[i] = vm.envAddress("BUIDL_ADDRESS");   feedIds[i] = bytes32("BUIDL");   i++;
        tokens[i] = vm.envAddress("ONDO_ADDRESS");    feedIds[i] = bytes32("ONDO");    i++;
        tokens[i] = vm.envAddress("VBILL_ADDRESS");   feedIds[i] = bytes32("VBILL");   i++;

        // FX
        tokens[i] = vm.envAddress("BRL_ADDRESS");     feedIds[i] = bytes32("BRL");     i++;
        tokens[i] = vm.envAddress("EUR_ADDRESS");     feedIds[i] = bytes32("EUR");     i++;
        tokens[i] = vm.envAddress("GBP_ADDRESS");     feedIds[i] = bytes32("GBP");     i++;
        tokens[i] = vm.envAddress("IDR_ADDRESS");     feedIds[i] = bytes32("IDR");     i++;
        tokens[i] = vm.envAddress("JPY_ADDRESS");     feedIds[i] = bytes32("JPY");     i++;
        tokens[i] = vm.envAddress("KRW_ADDRESS");     feedIds[i] = bytes32("KRW");     i++;
        tokens[i] = vm.envAddress("SGD_ADDRESS");     feedIds[i] = bytes32("SGD");     i++;
        tokens[i] = vm.envAddress("TRY_ADDRESS");     feedIds[i] = bytes32("TRY");     i++;

        // Indices
        tokens[i] = vm.envAddress("KOSPI200_ADDRESS");  feedIds[i] = bytes32("KOSPI200");  i++;
        tokens[i] = vm.envAddress("NIKKEI225_ADDRESS"); feedIds[i] = bytes32("NIKKEI225"); i++;
        tokens[i] = vm.envAddress("USA100_ADDRESS");    feedIds[i] = bytes32("USA100");    i++;
        tokens[i] = vm.envAddress("USA500_ADDRESS");    feedIds[i] = bytes32("USA500");    i++;

        // Stocks
        tokens[i] = vm.envAddress("AAPL_ADDRESS");   feedIds[i] = bytes32("AAPL");   i++;
        tokens[i] = vm.envAddress("AMZN_ADDRESS");   feedIds[i] = bytes32("AMZN");   i++;
        tokens[i] = vm.envAddress("GOOGL_ADDRESS");  feedIds[i] = bytes32("GOOGL");  i++;
        tokens[i] = vm.envAddress("META_ADDRESS");   feedIds[i] = bytes32("META");   i++;
        tokens[i] = vm.envAddress("MSFT_ADDRESS");   feedIds[i] = bytes32("MSFT");   i++;
        tokens[i] = vm.envAddress("NVDA_ADDRESS");   feedIds[i] = bytes32("NVDA");   i++;
        tokens[i] = vm.envAddress("PLTR_ADDRESS");   feedIds[i] = bytes32("PLTR");   i++;
        tokens[i] = vm.envAddress("TSLA_ADDRESS");   feedIds[i] = bytes32("TSLA");   i++;

        vm.startBroadcast(deployerKey);
        PriceFeed(priceFeed).setFeedIds(tokens, feedIds);
        vm.stopBroadcast();

        console.log("=== RWA FeedIds Registered in PriceFeed ===");
        console.log("PriceFeed:", priceFeed);
        console.log("Total tokens registered:", i);
        console.log("");
        console.log("Bonds:       CETES, GILTS, KTB, TESOURO");
        console.log("Commodities: URANIUM, WTI, XAG, XAU, XAUt, XCU, XPT");
        console.log("Funds:       ACRED, BENJI, BUIDL, ONDO, VBILL");
        console.log("FX:          BRL, EUR, GBP, IDR, JPY, KRW, SGD, TRY");
        console.log("Indices:     KOSPI200, NIKKEI225, USA100, USA500");
        console.log("Stocks:      AAPL, AMZN, GOOGL, META, MSFT, NVDA, PLTR, TSLA");
    }
}
