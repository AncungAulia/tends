// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {MockUSDC}  from "../src/mocktoken/MockUSDC.sol";
import {MockMUSD}  from "../src/mocktoken/MockMUSD.sol";
import {MockUSDY}  from "../src/mocktoken/MockUSDY.sol";
import {MockMETH}  from "../src/mocktoken/MockMETH.sol";
import {MockCMETH} from "../src/mocktoken/MockCMETH.sol";
import {MockSUSDE} from "../src/mocktoken/MockSUSDE.sol";
import {MockWMNT}  from "../src/mocktoken/MockWMNT.sol";

import {PriceFeed}        from "../src/PriceFeed.sol";
import {AgentActivityLog} from "../src/AgentActivityLog.sol";
import {MockDexAdapter}   from "../src/MockDexAdapter.sol";
import {StrategyRouter}   from "../src/StrategyRouter.sol";
import {UserVault}        from "../src/UserVault.sol";
import {VaultFactory}     from "../src/VaultFactory.sol";
import {MockOracleHelper} from "./MockOracleHelper.sol";

abstract contract BaseTest is Test {
    // ── Actors ──────────────────────────────────────────────────────────────
    address internal owner;
    address internal agentExecutor;
    address internal alice;
    uint256 internal aliceKey;
    address internal bob;
    address internal carol;

    // ── Mock tokens ─────────────────────────────────────────────────────────
    MockUSDC  internal mockUSDC;
    MockMUSD  internal mockMUSD;
    MockUSDY  internal mockUSDY;
    MockMETH  internal mockMETH;
    MockCMETH internal mockCMETH;
    MockSUSDE internal mockSUSDE;
    MockWMNT  internal mockWMNT;

    // ── Protocol contracts ───────────────────────────────────────────────────
    MockOracleHelper internal mockOracle;
    PriceFeed        internal priceFeed;
    AgentActivityLog internal activityLog;
    MockDexAdapter   internal dexAdapter;
    StrategyRouter   internal strategyRouter;
    UserVault        internal vaultImpl;
    VaultFactory     internal factory;

    // ── Price constants (1e18 USD scale) ────────────────────────────────────
    uint256 internal constant PRICE_USDC  = 1e18;
    uint256 internal constant PRICE_MUSD  = 1e18;
    uint256 internal constant PRICE_USDY  = 105e16;  // $1.05
    uint256 internal constant PRICE_METH  = 2000e18;
    uint256 internal constant PRICE_CMETH = 2100e18;
    uint256 internal constant PRICE_SUSDE = 108e16;  // $1.08
    uint256 internal constant PRICE_WMNT  = 5e17;    // $0.50

    // ── Feed IDs (mirrors MockOracle / RedStone feedId conventions) ──────────
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 internal constant FEED_USDY  = bytes32("USDY");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 internal constant FEED_METH  = bytes32("mETH_FUNDAMENTAL");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 internal constant FEED_CMETH = bytes32("cmETH");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 internal constant FEED_SUSDE = bytes32("sUSDe");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 internal constant FEED_WMNT  = bytes32("MNT");

    // ── Setup ────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        vm.warp(2 hours);

        owner         = makeAddr("owner");
        agentExecutor = makeAddr("agentExecutor");
        (alice, aliceKey) = makeAddrAndKey("alice");
        bob   = makeAddr("bob");
        carol = makeAddr("carol");

        // MockOracleHelper deployed outside prank — anyone can call setPrice in tests
        mockOracle = new MockOracleHelper();

        vm.startPrank(owner);

        // 1. Mock tokens
        mockUSDC  = new MockUSDC();
        mockMUSD  = new MockMUSD();
        mockUSDY  = new MockUSDY();
        mockMETH  = new MockMETH();
        mockCMETH = new MockCMETH();
        mockSUSDE = new MockSUSDE();
        mockWMNT  = new MockWMNT();

        // 2. PriceFeed (UUPS) — reads from MockOracleHelper
        priceFeed = PriceFeed(address(new ERC1967Proxy(
            address(new PriceFeed()),
            abi.encodeCall(PriceFeed.initialize, (owner, address(mockOracle)))
        )));

        // 2a. Static prices for pegged stablecoins (no oracle lookup needed)
        priceFeed.setStaticPrice(address(mockUSDC), PRICE_USDC);
        priceFeed.setStaticPrice(address(mockMUSD), PRICE_MUSD);

        // 2b. FeedId mappings for RWA tokens → MockOracle
        address[] memory rwaAddrs = new address[](5);
        rwaAddrs[0] = address(mockUSDY);
        rwaAddrs[1] = address(mockMETH);
        rwaAddrs[2] = address(mockCMETH);
        rwaAddrs[3] = address(mockSUSDE);
        rwaAddrs[4] = address(mockWMNT);

        bytes32[] memory feedIdArr = new bytes32[](5);
        feedIdArr[0] = FEED_USDY;
        feedIdArr[1] = FEED_METH;
        feedIdArr[2] = FEED_CMETH;
        feedIdArr[3] = FEED_SUSDE;
        feedIdArr[4] = FEED_WMNT;

        priceFeed.setFeedIds(rwaAddrs, feedIdArr);

        // 3. AgentActivityLog (UUPS)
        activityLog = AgentActivityLog(address(new ERC1967Proxy(
            address(new AgentActivityLog()),
            abi.encodeCall(AgentActivityLog.initialize, (owner))
        )));

        // 4. MockDexAdapter (non-upgradeable)
        dexAdapter = new MockDexAdapter(address(priceFeed));

        // 5. StrategyRouter (UUPS)
        strategyRouter = StrategyRouter(address(new ERC1967Proxy(
            address(new StrategyRouter()),
            abi.encodeCall(StrategyRouter.initialize, (owner, address(dexAdapter)))
        )));

        // 6. UserVault implementation (factory deploys proxies)
        vaultImpl = new UserVault();

        // 7. VaultFactory (UUPS) — receives only RWA tokens (not USDC, which is the asset)
        factory = VaultFactory(address(new ERC1967Proxy(
            address(new VaultFactory()),
            abi.encodeCall(VaultFactory.initialize, (
                owner,
                address(vaultImpl),
                address(mockUSDC),
                agentExecutor,
                address(strategyRouter),
                address(activityLog),
                address(priceFeed),
                address(mockWMNT),
                _rwaTokens()
            ))
        )));

        // 8. Wire factory roles so deployVault() can auto-authorize
        strategyRouter.setFactory(address(factory));
        activityLog.setFactory(address(factory));

        // 9. Whitelist all tokens in StrategyRouter (USDC + RWA tokens)
        strategyRouter.setAllowedTokens(_allTokens(), true);

        // 10. Authorize agentExecutor as a standalone logger
        activityLog.authorizeLogger(agentExecutor, true);

        vm.stopPrank();

        // 11. Push initial prices
        _setPrices();

        // 12. Fund MockDexAdapter so it can fulfill swaps
        _fundDexAdapter();

        // 13. Give actors funds
        mockUSDC.mint(alice, 100_000e6);
        mockUSDC.mint(bob,   100_000e6);
        mockUSDC.mint(carol, 100_000e6);
        vm.deal(alice, 100 ether);
        vm.deal(bob,   100 ether);
        vm.deal(carol, 100 ether);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _rwaTokens() internal view returns (address[] memory t) {
        t = new address[](6);
        t[0] = address(mockMUSD);
        t[1] = address(mockUSDY);
        t[2] = address(mockMETH);
        t[3] = address(mockCMETH);
        t[4] = address(mockSUSDE);
        t[5] = address(mockWMNT);
    }

    function _allTokens() internal view returns (address[] memory t) {
        t = new address[](7);
        t[0] = address(mockUSDC);
        t[1] = address(mockMUSD);
        t[2] = address(mockUSDY);
        t[3] = address(mockMETH);
        t[4] = address(mockCMETH);
        t[5] = address(mockSUSDE);
        t[6] = address(mockWMNT);
    }

    function _setPrices() internal {
        // Push RWA prices to MockOracleHelper — mirrors what backend relayer does on testnet.
        // USDC and mUSD use static prices in PriceFeed, so no oracle push needed for them.
        mockOracle.setPrice(FEED_USDY,  PRICE_USDY);
        mockOracle.setPrice(FEED_METH,  PRICE_METH);
        mockOracle.setPrice(FEED_CMETH, PRICE_CMETH);
        mockOracle.setPrice(FEED_SUSDE, PRICE_SUSDE);
        mockOracle.setPrice(FEED_WMNT,  PRICE_WMNT);
    }

    function _fundDexAdapter() internal {
        mockUSDC.mint(address(dexAdapter),  10_000_000e6);
        mockMUSD.mint(address(dexAdapter),  10_000_000 ether);
        mockUSDY.mint(address(dexAdapter),  10_000_000 ether);
        mockMETH.mint(address(dexAdapter),  10_000 ether);
        mockCMETH.mint(address(dexAdapter), 10_000 ether);
        mockSUSDE.mint(address(dexAdapter), 10_000_000 ether);
        mockWMNT.mint(address(dexAdapter),  10_000_000 ether);
    }

    function _deployVaultFor(address user) internal returns (UserVault vault) {
        vm.prank(user);
        vault = UserVault(factory.deployVault());
    }

    function _deposit(address user, UserVault vault, uint256 amount) internal returns (uint256 shares) {
        vm.startPrank(user);
        mockUSDC.approve(address(vault), amount);
        shares = vault.deposit(amount, user);
        vm.stopPrank();
    }

    function _rebalance(UserVault vault, address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut)
        internal
    {
        UserVault.SwapInstruction[] memory instr = new UserVault.SwapInstruction[](1);
        instr[0] = UserVault.SwapInstruction(tokenIn, tokenOut, amountIn, minOut);
        // Set both msg.sender and tx.origin so AgentActivityLog records agentExecutor correctly
        vm.prank(agentExecutor, agentExecutor);
        vault.rebalance(instr);
    }

    /// @dev Advance time and refresh prices to avoid StalePrice revert.
    function _warpAndRefresh(uint256 secs) internal {
        vm.warp(block.timestamp + secs);
        _setPrices();
    }
}
