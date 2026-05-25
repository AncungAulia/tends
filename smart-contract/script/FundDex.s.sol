// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

import {MockUSDC}  from "../src/mocktoken/MockUSDC.sol";
import {MockMUSD}  from "../src/mocktoken/MockMUSD.sol";
import {MockUSDY}  from "../src/mocktoken/MockUSDY.sol";
import {MockMETH}  from "../src/mocktoken/MockMETH.sol";
import {MockCMETH} from "../src/mocktoken/MockCMETH.sol";
import {MockSUSDE} from "../src/mocktoken/MockSUSDE.sol";
import {MockWMNT}  from "../src/mocktoken/MockWMNT.sol";

/// @notice Mints large liquidity reserves into MockDexAdapter so it can fill swaps.
/// @dev Run once after DeployCore. Re-run any time adapter balance runs low.
///
///   forge script script/FundDex.s.sol:FundDexScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract FundDexScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address dexAdapter  = vm.envAddress("DEX_ADAPTER_ADDRESS");

        address usdc  = vm.envAddress("USDC_ADDRESS");
        address musd  = vm.envAddress("MUSD_ADDRESS");
        address usdy  = vm.envAddress("USDY_ADDRESS");
        address meth  = vm.envAddress("METH_ADDRESS");
        address cmeth = vm.envAddress("CMETH_ADDRESS");
        address susde = vm.envAddress("SUSDE_ADDRESS");
        address payable wmnt  = payable(vm.envAddress("WMNT_ADDRESS"));

        vm.startBroadcast(deployerKey);

        MockUSDC(usdc).mint(dexAdapter,   10_000_000e6);      // 10M USDC (6 dec)
        MockMUSD(musd).mint(dexAdapter,   10_000_000 ether);  // 10M mUSD
        MockUSDY(usdy).mint(dexAdapter,   10_000_000 ether);  // 10M USDY
        MockMETH(meth).mint(dexAdapter,       10_000 ether);  // 10k mETH
        MockCMETH(cmeth).mint(dexAdapter,     10_000 ether);  // 10k cmETH
        MockSUSDE(susde).mint(dexAdapter, 10_000_000 ether);  // 10M sUSDe
        MockWMNT(wmnt).mint(dexAdapter,   10_000_000 ether);  // 10M WMNT

        vm.stopBroadcast();

        console.log("=== MockDexAdapter Funded ===");
        console.log("Adapter:", dexAdapter);
        console.log("USDC:   10,000,000");
        console.log("mUSD:   10,000,000");
        console.log("USDY:   10,000,000");
        console.log("mETH:       10,000");
        console.log("cmETH:      10,000");
        console.log("sUSDe:  10,000,000");
        console.log("WMNT:   10,000,000");
    }
}
