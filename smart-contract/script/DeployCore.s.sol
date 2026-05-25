// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {PriceFeed}        from "../src/PriceFeed.sol";
import {AgentActivityLog} from "../src/AgentActivityLog.sol";
import {MockDexAdapter}   from "../src/MockDexAdapter.sol";
import {StrategyRouter}   from "../src/StrategyRouter.sol";
import {UserVault}        from "../src/UserVault.sol";
import {VaultFactory}     from "../src/VaultFactory.sol";

/// @notice Deploys and fully configures the Tends core protocol on Mantle Sepolia.
/// @dev Prerequisites:
///   1. Run DeployMocks.s.sol and set USDC_ADDRESS … WMNT_ADDRESS in .env
///   2. Set AGENT_EXECUTOR and MOCK_ORACLE in .env
///      MOCK_ORACLE = 0x26f9178b4082b68D8cC55874D377f9829Fc8C22d (Mantle Sepolia)
///
///   forge script script/DeployCore.s.sol:DeployCoreScript \
///     --rpc-url mantle_sepolia --broadcast --verify -vvvv
contract DeployCoreScript is Script {
    // Feed IDs that match the backend MockOracle relayer.
    // USDC and mUSD use static prices — no feed needed.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant FEED_USDY  = bytes32("USDY");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant FEED_METH  = bytes32("mETH_FUNDAMENTAL");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant FEED_CMETH = bytes32("cmETH");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant FEED_SUSDE = bytes32("sUSDe");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 constant FEED_WMNT  = bytes32("MNT");

    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address deployer     = vm.addr(deployerKey);
        address agentExecutor = vm.envAddress("AGENT_EXECUTOR");
        address mockOracle   = vm.envAddress("MOCK_ORACLE");

        // Mock token addresses (deployed by DeployMocks.s.sol)
        address usdc  = vm.envAddress("USDC_ADDRESS");
        address musd  = vm.envAddress("MUSD_ADDRESS");
        address usdy  = vm.envAddress("USDY_ADDRESS");
        address meth  = vm.envAddress("METH_ADDRESS");
        address cmeth = vm.envAddress("CMETH_ADDRESS");
        address susde = vm.envAddress("SUSDE_ADDRESS");
        address wmnt  = vm.envAddress("WMNT_ADDRESS");

        vm.startBroadcast(deployerKey);

        // ── 1. PriceFeed (UUPS) ──────────────────────────────────────────────
        PriceFeed priceFeedImpl = new PriceFeed();
        PriceFeed priceFeed = PriceFeed(address(new ERC1967Proxy(
            address(priceFeedImpl),
            abi.encodeCall(PriceFeed.initialize, (deployer, mockOracle))
        )));

        // Static prices for pegged stablecoins
        priceFeed.setStaticPrice(usdc, 1e18);
        priceFeed.setStaticPrice(musd, 1e18);

        // Oracle feed IDs for RWA tokens
        address[] memory rwaAddrs = new address[](5);
        rwaAddrs[0] = usdy;
        rwaAddrs[1] = meth;
        rwaAddrs[2] = cmeth;
        rwaAddrs[3] = susde;
        rwaAddrs[4] = wmnt;

        bytes32[] memory feedIds = new bytes32[](5);
        feedIds[0] = FEED_USDY;
        feedIds[1] = FEED_METH;
        feedIds[2] = FEED_CMETH;
        feedIds[3] = FEED_SUSDE;
        feedIds[4] = FEED_WMNT;

        priceFeed.setFeedIds(rwaAddrs, feedIds);

        // ── 2. AgentActivityLog (UUPS) ───────────────────────────────────────
        AgentActivityLog logImpl = new AgentActivityLog();
        AgentActivityLog activityLog = AgentActivityLog(address(new ERC1967Proxy(
            address(logImpl),
            abi.encodeCall(AgentActivityLog.initialize, (deployer))
        )));

        // ── 3. MockDexAdapter (non-upgradeable) ─────────────────────────────
        MockDexAdapter dexAdapter = new MockDexAdapter(address(priceFeed));

        // ── 4. StrategyRouter (UUPS) ─────────────────────────────────────────
        StrategyRouter routerImpl = new StrategyRouter();
        StrategyRouter strategyRouter = StrategyRouter(address(new ERC1967Proxy(
            address(routerImpl),
            abi.encodeCall(StrategyRouter.initialize, (deployer, address(dexAdapter)))
        )));

        // Allow all 7 tokens in router
        address[] memory allTokens = new address[](7);
        allTokens[0] = usdc;
        allTokens[1] = musd;
        allTokens[2] = usdy;
        allTokens[3] = meth;
        allTokens[4] = cmeth;
        allTokens[5] = susde;
        allTokens[6] = wmnt;
        strategyRouter.setAllowedTokens(allTokens, true);

        // ── 5. UserVault implementation ──────────────────────────────────────
        UserVault vaultImpl = new UserVault();

        // ── 6. VaultFactory (UUPS) ───────────────────────────────────────────
        // RWA tokens passed to factory — these become the vault's allowedTokens.
        // USDC is the vault asset (not in allowedTokens).
        address[] memory rwaTokens = new address[](6);
        rwaTokens[0] = musd;
        rwaTokens[1] = usdy;
        rwaTokens[2] = meth;
        rwaTokens[3] = cmeth;
        rwaTokens[4] = susde;
        rwaTokens[5] = wmnt;

        VaultFactory factoryImpl = new VaultFactory();
        VaultFactory factory = VaultFactory(address(new ERC1967Proxy(
            address(factoryImpl),
            abi.encodeCall(VaultFactory.initialize, (
                deployer,
                address(vaultImpl),
                usdc,
                agentExecutor,
                address(strategyRouter),
                address(activityLog),
                address(priceFeed),
                wmnt,
                rwaTokens
            ))
        )));

        // ── 7. Wire factory roles ────────────────────────────────────────────
        // Factory auto-authorizes new vaults in StrategyRouter + AgentActivityLog
        strategyRouter.setFactory(address(factory));
        activityLog.setFactory(address(factory));

        // Authorize agentExecutor as a direct logger (for off-chain activity records)
        activityLog.authorizeLogger(agentExecutor, true);

        vm.stopBroadcast();

        // ── Output ───────────────────────────────────────────────────────────
        console.log("=== Tends Core Deployed ===");
        console.log("PriceFeed:        ", address(priceFeed));
        console.log("AgentActivityLog: ", address(activityLog));
        console.log("MockDexAdapter:   ", address(dexAdapter));
        console.log("StrategyRouter:   ", address(strategyRouter));
        console.log("UserVault impl:   ", address(vaultImpl));
        console.log("VaultFactory:     ", address(factory));
        console.log("");
        console.log("Implementation contracts (do not call directly):");
        console.log("  PriceFeed impl:    ", address(priceFeedImpl));
        console.log("  ActivityLog impl:  ", address(logImpl));
        console.log("  Router impl:       ", address(routerImpl));
        console.log("  Factory impl:      ", address(factoryImpl));
        console.log("");
        console.log("Next: run FundDex.s.sol to seed MockDexAdapter with liquidity.");
    }
}
