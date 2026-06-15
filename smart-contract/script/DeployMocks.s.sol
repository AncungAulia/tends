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

/// @notice Deploys the 7 core mock tokens to Mantle Sepolia.
/// @dev After running, copy logged addresses into .env before running DeployCore.s.sol.
///
///   forge script script/DeployMocks.s.sol:DeployMocksScript \
///     --rpc-url mantle_sepolia --broadcast --verify -vvvv
contract DeployMocksScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MockUSDC  usdc  = new MockUSDC();
        MockMUSD  musd  = new MockMUSD();
        MockUSDY  usdy  = new MockUSDY();
        MockMETH  meth  = new MockMETH();
        MockCMETH cmeth = new MockCMETH();
        MockSUSDE susde = new MockSUSDE();
        MockWMNT  wmnt  = new MockWMNT();

        vm.stopBroadcast();

        console.log("=== Mock Tokens Deployed ===");
        console.log("USDC:  ", address(usdc));
        console.log("mUSD:  ", address(musd));
        console.log("USDY:  ", address(usdy));
        console.log("mETH:  ", address(meth));
        console.log("cmETH: ", address(cmeth));
        console.log("sUSDe: ", address(susde));
        console.log("WMNT:  ", address(wmnt));
        console.log("");
        console.log("Add to .env:");
        console.log("USDC_ADDRESS=", address(usdc));
        console.log("MUSD_ADDRESS=", address(musd));
        console.log("USDY_ADDRESS=", address(usdy));
        console.log("METH_ADDRESS=", address(meth));
        console.log("CMETH_ADDRESS=", address(cmeth));
        console.log("SUSDE_ADDRESS=", address(susde));
        console.log("WMNT_ADDRESS=", address(wmnt));
    }
}
