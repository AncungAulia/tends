// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

/// @notice Minimal interface — every mock token exposes mint() with no access control.
interface IMintable {
    function mint(address to, uint256 amount) external;
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function balanceOf(address) external view returns (uint256);
}

/// @notice Mint massive liquidity reserves into MockDexAdapter for ALL 42 tokens.
///
///   forge script script/FundDexFull.s.sol:FundDexFullScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract FundDexFullScript is Script {
    // Mint 10 000 000 000 000 000 raw units of every 18-decimal token
    // = 10_000_000_000 ether (10 billion tokens) — enough for any testnet swap.
    uint256 constant AMOUNT_18 = 10_000_000_000 ether;
    // USDC has 6 decimals — same USD value
    uint256 constant AMOUNT_6  = 10_000_000_000e6;

    function run() external {
        uint256 pk         = vm.envUint("PRIVATE_KEY");
        address dexAdapter = vm.envAddress("DEX_ADAPTER_ADDRESS");

        vm.startBroadcast(pk);

        // ── Core mocks ────────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("USDC_ADDRESS"),    AMOUNT_6,  "USDC");
        _fund(dexAdapter, vm.envAddress("MUSD_ADDRESS"),    AMOUNT_18, "mUSD");
        _fund(dexAdapter, vm.envAddress("USDY_ADDRESS"),    AMOUNT_18, "USDY");
        _fund(dexAdapter, vm.envAddress("METH_ADDRESS"),    AMOUNT_18, "mETH");
        _fund(dexAdapter, vm.envAddress("CMETH_ADDRESS"),   AMOUNT_18, "cmETH");
        _fund(dexAdapter, vm.envAddress("SUSDE_ADDRESS"),   AMOUNT_18, "sUSDe");
        _fund(dexAdapter, vm.envAddress("WMNT_ADDRESS"),    AMOUNT_18, "WMNT");

        // ── Bonds ─────────────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("CETES_ADDRESS"),   AMOUNT_18, "CETES");
        _fund(dexAdapter, vm.envAddress("GILTS_ADDRESS"),   AMOUNT_18, "GILTS");
        _fund(dexAdapter, vm.envAddress("KTB_ADDRESS"),     AMOUNT_18, "KTB");
        _fund(dexAdapter, vm.envAddress("TESOURO_ADDRESS"), AMOUNT_18, "TESOURO");

        // ── Funds / RWA ───────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("ACRED_ADDRESS"),   AMOUNT_18, "ACRED");
        _fund(dexAdapter, vm.envAddress("BENJI_ADDRESS"),   AMOUNT_18, "BENJI");
        _fund(dexAdapter, vm.envAddress("BUIDL_ADDRESS"),   AMOUNT_18, "BUIDL");
        _fund(dexAdapter, vm.envAddress("ONDO_ADDRESS"),    AMOUNT_18, "ONDO");
        _fund(dexAdapter, vm.envAddress("VBILL_ADDRESS"),   AMOUNT_18, "VBILL");

        // ── Commodities ───────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("URANIUM_ADDRESS"), AMOUNT_18, "URANIUM");
        _fund(dexAdapter, vm.envAddress("WTI_ADDRESS"),     AMOUNT_18, "WTI");
        _fund(dexAdapter, vm.envAddress("XAG_ADDRESS"),     AMOUNT_18, "XAG");
        _fund(dexAdapter, vm.envAddress("XAU_ADDRESS"),     AMOUNT_18, "XAU");
        _fund(dexAdapter, vm.envAddress("XAUT_ADDRESS"),    AMOUNT_18, "XAUt");
        _fund(dexAdapter, vm.envAddress("XCU_ADDRESS"),     AMOUNT_18, "XCU");
        _fund(dexAdapter, vm.envAddress("XPT_ADDRESS"),     AMOUNT_18, "XPT");

        // ── Indices ───────────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("KOSPI200_ADDRESS"),  AMOUNT_18, "KOSPI200");
        _fund(dexAdapter, vm.envAddress("NIKKEI225_ADDRESS"), AMOUNT_18, "NIKKEI225");
        _fund(dexAdapter, vm.envAddress("USA100_ADDRESS"),    AMOUNT_18, "USA100");
        _fund(dexAdapter, vm.envAddress("USA500_ADDRESS"),    AMOUNT_18, "USA500");

        // ── Stocks ────────────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("AAPL_ADDRESS"),  AMOUNT_18, "AAPL");
        _fund(dexAdapter, vm.envAddress("AMZN_ADDRESS"),  AMOUNT_18, "AMZN");
        _fund(dexAdapter, vm.envAddress("GOOGL_ADDRESS"), AMOUNT_18, "GOOGL");
        _fund(dexAdapter, vm.envAddress("META_ADDRESS"),  AMOUNT_18, "META");
        _fund(dexAdapter, vm.envAddress("MSFT_ADDRESS"),  AMOUNT_18, "MSFT");
        _fund(dexAdapter, vm.envAddress("NVDA_ADDRESS"),  AMOUNT_18, "NVDA");
        _fund(dexAdapter, vm.envAddress("PLTR_ADDRESS"),  AMOUNT_18, "PLTR");
        _fund(dexAdapter, vm.envAddress("TSLA_ADDRESS"),  AMOUNT_18, "TSLA");

        // ── FX ────────────────────────────────────────────────────────────────
        _fund(dexAdapter, vm.envAddress("BRL_ADDRESS"), AMOUNT_18, "BRL");
        _fund(dexAdapter, vm.envAddress("EUR_ADDRESS"), AMOUNT_18, "EUR");
        _fund(dexAdapter, vm.envAddress("GBP_ADDRESS"), AMOUNT_18, "GBP");
        _fund(dexAdapter, vm.envAddress("IDR_ADDRESS"), AMOUNT_18, "IDR");
        _fund(dexAdapter, vm.envAddress("JPY_ADDRESS"), AMOUNT_18, "JPY");
        _fund(dexAdapter, vm.envAddress("KRW_ADDRESS"), AMOUNT_18, "KRW");
        _fund(dexAdapter, vm.envAddress("SGD_ADDRESS"), AMOUNT_18, "SGD");
        _fund(dexAdapter, vm.envAddress("TRY_ADDRESS"), AMOUNT_18, "TRY");

        vm.stopBroadcast();

        console.log("=== MockDexAdapter fully funded ===");
        console.log("Adapter :", dexAdapter);
        console.log("Tokens  : 42");
        console.log("Amount  : 10,000,000,000 per token (18-dec) / 10,000,000,000,000,000 USDC");
    }

    function _fund(address adapter, address token, uint256 amount, string memory sym) internal {
        IMintable(token).mint(adapter, amount);
        uint256 bal = IMintable(token).balanceOf(adapter);
        console.log(string.concat(sym, " balance: "), bal);
    }
}
