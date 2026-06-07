// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {MockDexAdapter} from "../src/MockDexAdapter.sol";

interface IStrategyRouter {
    function setDexAdapter(address newAdapter) external;
}

/// @notice Deploy a fresh MockDexAdapter and wire it into StrategyRouter.
///
///   forge script script/DeployMockDex.s.sol:DeployMockDexScript \
///     --rpc-url mantle_sepolia --broadcast -vvvv
contract DeployMockDexScript is Script {
    function run() external {
        uint256 pk      = vm.envUint("PRIVATE_KEY");
        address feed    = vm.envAddress("PRICE_FEED_ADDRESS");
        address router  = vm.envAddress("STRATEGY_ROUTER_ADDRESS");

        vm.startBroadcast(pk);

        MockDexAdapter dex = new MockDexAdapter(feed);
        console.log("New MockDexAdapter:", address(dex));
        console.log("MOCK_SLIPPAGE_BPS :", dex.MOCK_SLIPPAGE_BPS());

        IStrategyRouter(router).setDexAdapter(address(dex));
        console.log("StrategyRouter.dexAdapter updated");

        vm.stopBroadcast();
    }
}
