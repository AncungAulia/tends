// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

// Bonds
import {MockCETES}   from "../src/mocktoken/bonds/MockCETES.sol";
import {MockGILTS}   from "../src/mocktoken/bonds/MockGILTS.sol";
import {MockKTB}     from "../src/mocktoken/bonds/MockKTB.sol";
import {MockTESOURO} from "../src/mocktoken/bonds/MockTESOURO.sol";

// Commodities
import {MockURANIUM} from "../src/mocktoken/commodities/MockURANIUM.sol";
import {MockWTI}     from "../src/mocktoken/commodities/MockWTI.sol";
import {MockXAG}     from "../src/mocktoken/commodities/MockXAG.sol";
import {MockXAU}     from "../src/mocktoken/commodities/MockXAU.sol";
import {MockXAUt}    from "../src/mocktoken/commodities/MockXAUt.sol";
import {MockXCU}     from "../src/mocktoken/commodities/MockXCU.sol";
import {MockXPT}     from "../src/mocktoken/commodities/MockXPT.sol";

// Crypto
import {MockBTC}    from "../src/mocktoken/crypto/MockBTC.sol";
import {MockETH}    from "../src/mocktoken/crypto/MockETH.sol";
import {MockEzETH}  from "../src/mocktoken/crypto/MockEzETH.sol";
import {MockMNT}    from "../src/mocktoken/crypto/MockMNT.sol";
import {MockRETH}   from "../src/mocktoken/crypto/MockRETH.sol";
import {MockStETH}  from "../src/mocktoken/crypto/MockStETH.sol";
import {MockWeETH}  from "../src/mocktoken/crypto/MockWeETH.sol";
import {MockWstETH} from "../src/mocktoken/crypto/MockWstETH.sol";

// Funds
import {MockACRED} from "../src/mocktoken/funds/MockACRED.sol";
import {MockBENJI} from "../src/mocktoken/funds/MockBENJI.sol";
import {MockBUIDL} from "../src/mocktoken/funds/MockBUIDL.sol";
import {MockONDO}  from "../src/mocktoken/funds/MockONDO.sol";
import {MockVBILL} from "../src/mocktoken/funds/MockVBILL.sol";

// FX
import {MockBRL} from "../src/mocktoken/fx/MockBRL.sol";
import {MockEUR} from "../src/mocktoken/fx/MockEUR.sol";
import {MockGBP} from "../src/mocktoken/fx/MockGBP.sol";
import {MockIDR} from "../src/mocktoken/fx/MockIDR.sol";
import {MockJPY} from "../src/mocktoken/fx/MockJPY.sol";
import {MockKRW} from "../src/mocktoken/fx/MockKRW.sol";
import {MockSGD} from "../src/mocktoken/fx/MockSGD.sol";
import {MockTRY} from "../src/mocktoken/fx/MockTRY.sol";

// Indices
import {MockKOSPI200}  from "../src/mocktoken/indices/MockKOSPI200.sol";
import {MockNIKKEI225} from "../src/mocktoken/indices/MockNIKKEI225.sol";
import {MockUSA100}    from "../src/mocktoken/indices/MockUSA100.sol";
import {MockUSA500}    from "../src/mocktoken/indices/MockUSA500.sol";

// Stocks
import {MockAAPL}  from "../src/mocktoken/stocks/MockAAPL.sol";
import {MockAMZN}  from "../src/mocktoken/stocks/MockAMZN.sol";
import {MockGOOGL} from "../src/mocktoken/stocks/MockGOOGL.sol";
import {MockMETA}  from "../src/mocktoken/stocks/MockMETA.sol";
import {MockMSFT}  from "../src/mocktoken/stocks/MockMSFT.sol";
import {MockNVDA}  from "../src/mocktoken/stocks/MockNVDA.sol";
import {MockPLTR}  from "../src/mocktoken/stocks/MockPLTR.sol";
import {MockTSLA}  from "../src/mocktoken/stocks/MockTSLA.sol";

contract DeployRWAMocksScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // ── Bonds ────────────────────────────────────────────────────────────
        MockCETES   cetes   = new MockCETES();
        MockGILTS   gilts   = new MockGILTS();
        MockKTB     ktb     = new MockKTB();
        MockTESOURO tesouro = new MockTESOURO();

        // ── Commodities ──────────────────────────────────────────────────────
        MockURANIUM uranium = new MockURANIUM();
        MockWTI     wti     = new MockWTI();
        MockXAG     xag     = new MockXAG();
        MockXAU     xau     = new MockXAU();
        MockXAUt    xaut    = new MockXAUt();
        MockXCU     xcu     = new MockXCU();
        MockXPT     xpt     = new MockXPT();

        // ── Crypto ───────────────────────────────────────────────────────────
        MockBTC    btc    = new MockBTC();
        MockETH    eth    = new MockETH();
        MockEzETH  ezeth  = new MockEzETH();
        MockMNT    mnt    = new MockMNT();
        MockRETH   reth   = new MockRETH();
        MockStETH  steth  = new MockStETH();
        MockWeETH  weeth  = new MockWeETH();
        MockWstETH wsteth = new MockWstETH();

        // ── Funds ────────────────────────────────────────────────────────────
        MockACRED acred = new MockACRED();
        MockBENJI benji = new MockBENJI();
        MockBUIDL buidl = new MockBUIDL();
        MockONDO  ondo  = new MockONDO();
        MockVBILL vbill = new MockVBILL();

        // ── FX ───────────────────────────────────────────────────────────────
        MockBRL brl = new MockBRL();
        MockEUR eur = new MockEUR();
        MockGBP gbp = new MockGBP();
        MockIDR idr = new MockIDR();
        MockJPY jpy = new MockJPY();
        MockKRW krw = new MockKRW();
        MockSGD sgd = new MockSGD();
        MockTRY tryToken = new MockTRY();

        // ── Indices ──────────────────────────────────────────────────────────
        MockKOSPI200  kospi200  = new MockKOSPI200();
        MockNIKKEI225 nikkei225 = new MockNIKKEI225();
        MockUSA100    usa100    = new MockUSA100();
        MockUSA500    usa500    = new MockUSA500();

        // ── Stocks ───────────────────────────────────────────────────────────
        MockAAPL  aapl  = new MockAAPL();
        MockAMZN  amzn  = new MockAMZN();
        MockGOOGL googl = new MockGOOGL();
        MockMETA  meta  = new MockMETA();
        MockMSFT  msft  = new MockMSFT();
        MockNVDA  nvda  = new MockNVDA();
        MockPLTR  pltr  = new MockPLTR();
        MockTSLA  tsla  = new MockTSLA();

        vm.stopBroadcast();

        console.log("=== RWA Mock Tokens Deployed ===");
        console.log("");
        console.log("# Bonds");
        console.log("CETES_ADDRESS=",   address(cetes));
        console.log("GILTS_ADDRESS=",   address(gilts));
        console.log("KTB_ADDRESS=",     address(ktb));
        console.log("TESOURO_ADDRESS=", address(tesouro));
        console.log("");
        console.log("# Commodities");
        console.log("URANIUM_ADDRESS=", address(uranium));
        console.log("WTI_ADDRESS=",     address(wti));
        console.log("XAG_ADDRESS=",     address(xag));
        console.log("XAU_ADDRESS=",     address(xau));
        console.log("XAUT_ADDRESS=",    address(xaut));
        console.log("XCU_ADDRESS=",     address(xcu));
        console.log("XPT_ADDRESS=",     address(xpt));
        console.log("");
        console.log("# Crypto");
        console.log("BTC_ADDRESS=",    address(btc));
        console.log("ETH_ADDRESS=",    address(eth));
        console.log("EZETH_ADDRESS=",  address(ezeth));
        console.log("MNT_ADDRESS=",    address(mnt));
        console.log("RETH_ADDRESS=",   address(reth));
        console.log("STETH_ADDRESS=",  address(steth));
        console.log("WEETH_ADDRESS=",  address(weeth));
        console.log("WSTETH_ADDRESS=", address(wsteth));
        console.log("");
        console.log("# Funds");
        console.log("ACRED_ADDRESS=", address(acred));
        console.log("BENJI_ADDRESS=", address(benji));
        console.log("BUIDL_ADDRESS=", address(buidl));
        console.log("ONDO_ADDRESS=",  address(ondo));
        console.log("VBILL_ADDRESS=", address(vbill));
        console.log("");
        console.log("# FX");
        console.log("BRL_ADDRESS=", address(brl));
        console.log("EUR_ADDRESS=", address(eur));
        console.log("GBP_ADDRESS=", address(gbp));
        console.log("IDR_ADDRESS=", address(idr));
        console.log("JPY_ADDRESS=", address(jpy));
        console.log("KRW_ADDRESS=", address(krw));
        console.log("SGD_ADDRESS=", address(sgd));
        console.log("TRY_ADDRESS=", address(tryToken));
        console.log("");
        console.log("# Indices");
        console.log("KOSPI200_ADDRESS=",  address(kospi200));
        console.log("NIKKEI225_ADDRESS=", address(nikkei225));
        console.log("USA100_ADDRESS=",    address(usa100));
        console.log("USA500_ADDRESS=",    address(usa500));
        console.log("");
        console.log("# Stocks");
        console.log("AAPL_ADDRESS=",  address(aapl));
        console.log("AMZN_ADDRESS=",  address(amzn));
        console.log("GOOGL_ADDRESS=", address(googl));
        console.log("META_ADDRESS=",  address(meta));
        console.log("MSFT_ADDRESS=",  address(msft));
        console.log("NVDA_ADDRESS=",  address(nvda));
        console.log("PLTR_ADDRESS=",  address(pltr));
        console.log("TSLA_ADDRESS=",  address(tsla));
    }
}
