/**
 * Mock feedId (key written to MockOracle, queried by PriceFeed) → RedStone source
 * data-feed id. Ported verbatim from ~/rwa-oracle/script/relayer.cjs (REDSTONE_FEEDS).
 * USDY is NOT here — it's read from the Ondo oracle on Mantle mainnet separately.
 */
export const REDSTONE_FEEDS: Record<string, string> = {
  // core (WMNT→MNT; USDC/mUSD are static $1 in PriceFeed, no oracle)
  mETH_FUNDAMENTAL: "mETH_FUNDAMENTAL",
  cmETH: "cmETH_FUNDAMENTAL", // RedStone has no plain "cmETH"
  sUSDe: "sUSDe",
  MNT: "MNT",

  // bonds
  CETES: "CETES", GILTS: "GILTS", KTB: "KTB", TESOURO: "TESOURO",

  // commodities
  URANIUM: "URANIUM", WTI: "WTI.T", XAG: "XAG", XAU: "XAU",
  XAUt: "XAUt", XCU: "XCU.T", XPT: "XPT",

  // funds (tokenized treasuries use _FUNDAMENTAL)
  ACRED: "ACRED_FUNDAMENTAL", BENJI: "BENJI_ETHEREUM_FUNDAMENTAL",
  BUIDL: "BUIDL_FUNDAMENTAL", ONDO: "ONDO", VBILL: "VBILL_ETHEREUM_FUNDAMENTAL",

  // fx (RedStone fiat use _FX suffix)
  BRL: "BRL", EUR: "EUR", GBP: "GBP", IDR: "IDR_FX",
  JPY: "JPY_FX", KRW: "KRW_FX", SGD: "SGD_FX", TRY: "TRY",

  // indices (.T suffix for US)
  KOSPI200: "KOSPI200", NIKKEI225: "NIKKEI225",
  USA100: "USA100.T", USA500: "USA500.T",

  // stocks
  AAPL: "AAPL", AMZN: "AMZN", GOOGL: "GOOGL", META: "META",
  MSFT: "MSFT", NVDA: "NVDA", PLTR: "PLTR", TSLA: "TSLA",

  // extra (not consumed yet; ETH needed to derive mETH/cmETH USD prices)
  BTC: "BTC", ETH: "ETH",
};

/**
 * Keys that hold an ETH-denominated RATE on RedStone (e.g. mETH/ETH ≈ 1.09).
 * Stored as USD = rate × ETH price so PriceFeed gets a real USD value without
 * changing the deployed contract's feedId mapping.
 */
export const RATE_TIMES_ETH = new Set(["mETH_FUNDAMENTAL", "cmETH"]);
