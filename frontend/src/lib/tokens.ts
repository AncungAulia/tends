// Full token catalog by category. Used for asset selectors, holdings labels,
// and category filters.

export type TokenCategory =
  | "core"
  | "bonds"
  | "commodities"
  | "funds"
  | "fx"
  | "indices"
  | "stocks";

export interface Token {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  category: TokenCategory;
}

export const TOKENS: Token[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { symbol: "USDC",      name: "USD Coin",          address: "0x29faf6cAFA4BeA1dC7c232f0a1818d4da6b724DD", decimals: 6,  category: "core" },
  { symbol: "mUSD",      name: "Mantle USD",        address: "0xADA0466303441102cb16F8eC1594C744d603f746", decimals: 18, category: "core" },
  { symbol: "USDY",      name: "Ondo USDY",         address: "0x0D7766158f14ad7bB82d9FD8A47734e801E3F5B8", decimals: 18, category: "core" },
  { symbol: "mETH",      name: "Mantle ETH",        address: "0xD89395Df78aaFdF86b330899d1C6189211e88750", decimals: 18, category: "core" },
  { symbol: "cmETH",     name: "Compound mETH",     address: "0xb6F57152bC6Ac9cdC7862f8dAe0AAC17f6F5D8fF", decimals: 18, category: "core" },
  { symbol: "sUSDe",     name: "Staked USDe",       address: "0xF76DA0ec605CFac82f1DA86080da21316C07d130", decimals: 18, category: "core" },
  { symbol: "WMNT",      name: "Wrapped MNT",       address: "0x61a4ac2678048ED431E362c14D2eC7A0B3191966", decimals: 18, category: "core" },

  // ── Bonds ───────────────────────────────────────────────────────────────
  { symbol: "CETES",     name: "Mexican T-Bills",   address: "0x1054424a70dae9098babec332e18a0f07d37d251", decimals: 18, category: "bonds" },
  { symbol: "GILTS",     name: "UK Gilts",          address: "0xbea967ace62d23d335ddad03972659509e1c3559", decimals: 18, category: "bonds" },
  { symbol: "KTB",       name: "Korean T-Bonds",    address: "0x10d9eb91d0a69098431fb833e666bd64455d45f3", decimals: 18, category: "bonds" },
  { symbol: "TESOURO",   name: "Brazilian Tesouro", address: "0xfda1e869846776e3c182f5e105640ac48d474605", decimals: 18, category: "bonds" },

  // ── Commodities ───────────────────────────────────────────────────────────
  { symbol: "URANIUM",   name: "Uranium",           address: "0x1d7939e37e08802a6b86204f8e3c52ba4a6cbfba", decimals: 18, category: "commodities" },
  { symbol: "WTI",       name: "WTI Crude Oil",     address: "0x932e82632e80b06318ca969e33f99a54f1a04b10", decimals: 18, category: "commodities" },
  { symbol: "XAG",       name: "Silver",            address: "0xf380e8b6803ad065ef0567dd20c894a55050737c", decimals: 18, category: "commodities" },
  { symbol: "XAU",       name: "Gold",              address: "0x5b0770513b6cd76bf225462f3ec42783e8da69a1", decimals: 18, category: "commodities" },
  { symbol: "XAUt",      name: "Tokenized Gold",    address: "0x0aa42416baccdb2fd4768b61111deb7f7d212f9b", decimals: 18, category: "commodities" },
  { symbol: "XCU",       name: "Copper",            address: "0xb3e1f06ac529aded2aa20aa38f4c0b4ad317e5f5", decimals: 18, category: "commodities" },
  { symbol: "XPT",       name: "Platinum",          address: "0x62e518611d5a135a50c18e5fcf3a333d6d3a0506", decimals: 18, category: "commodities" },

  // ── Funds ───────────────────────────────────────────────────────────────
  { symbol: "ACRED",     name: "Arca Credit",       address: "0x3d85b13c76fc218830e3c0d2e147d1a6b8f3cdc8", decimals: 18, category: "funds" },
  { symbol: "BENJI",     name: "Franklin Templeton", address: "0x56514dcf6e038ba1f77530cb9df01b2f9427ea11", decimals: 18, category: "funds" },
  { symbol: "BUIDL",     name: "BlackRock BUIDL",   address: "0x92cf957248c8a695da67d91835bd02e6371e5bfd", decimals: 18, category: "funds" },
  { symbol: "ONDO",      name: "Ondo Finance",      address: "0x4e3a788cd351f73d70c85f640758d90d7c573a4d", decimals: 18, category: "funds" },
  { symbol: "VBILL",     name: "Vault Bill",        address: "0xbc58f30dfaae433f5531a037365c06b98960e54a", decimals: 18, category: "funds" },

  // ── FX ────────────────────────────────────────────────────────────────────
  { symbol: "BRL",       name: "Brazilian Real",    address: "0xd568d045d34dca3f4f24be8099a8b90779047b6a", decimals: 18, category: "fx" },
  { symbol: "EUR",       name: "Euro",              address: "0x781dfd2a2e6b2fb23e10a4b36691520e4bc36e2a", decimals: 18, category: "fx" },
  { symbol: "GBP",       name: "British Pound",     address: "0x2cbc4431d40121faa5b5a6d15240285761128f5a", decimals: 18, category: "fx" },
  { symbol: "IDR",       name: "Indonesian Rupiah", address: "0x37e11a01f58f973098bef434a34e7fc3be4e3041", decimals: 18, category: "fx" },
  { symbol: "JPY",       name: "Japanese Yen",      address: "0x718c268093b11bea78a9b84861b2e4e96e86c33b", decimals: 18, category: "fx" },
  { symbol: "KRW",       name: "Korean Won",        address: "0x42feae1f60b23feb1f5c501977af161116fe3e99", decimals: 18, category: "fx" },
  { symbol: "SGD",       name: "Singapore Dollar",  address: "0x039263c8b98f62f7e2debcd277ef3f1f2baf9dce", decimals: 18, category: "fx" },
  { symbol: "TRY",       name: "Turkish Lira",      address: "0x58061565f6f2b5c8322ee3fa2dcd6497d72e5b20", decimals: 18, category: "fx" },

  // ── Indices ─────────────────────────────────────────────────────────────
  { symbol: "KOSPI200",  name: "KOSPI 200",         address: "0xc43bd39225a38ce33751c55c74741834a8e82d16", decimals: 18, category: "indices" },
  { symbol: "NIKKEI225", name: "Nikkei 225",        address: "0x6289654b4197744800d761a4641ba0c4a79f5ed1", decimals: 18, category: "indices" },
  { symbol: "USA100",    name: "Nasdaq 100",        address: "0x7bb9e063dab0b53fb7b7b438548d5a8c62e3afb7", decimals: 18, category: "indices" },
  { symbol: "USA500",    name: "S&P 500",           address: "0x6956dbbeb8eca1160ae21d2d703cdf6b86525825", decimals: 18, category: "indices" },

  // ── Stocks ────────────────────────────────────────────────────────────────
  { symbol: "AAPL",      name: "Apple",             address: "0xc2226548fb4332dce1e31dc317bcf61effd51375", decimals: 18, category: "stocks" },
  { symbol: "AMZN",      name: "Amazon",            address: "0x5dbc3c81dbbb39dd865ec27c66abb48150325df1", decimals: 18, category: "stocks" },
  { symbol: "GOOGL",     name: "Alphabet",          address: "0xdd63da0a5ec0a76029dd49c32de7de73d8918e96", decimals: 18, category: "stocks" },
  { symbol: "META",      name: "Meta",              address: "0x028ffc7b83ac3ec143bed5a8f14c7e49a356c793", decimals: 18, category: "stocks" },
  { symbol: "MSFT",      name: "Microsoft",         address: "0x61d3e9944feff4a17854e408c5ac766a1d9adb63", decimals: 18, category: "stocks" },
  { symbol: "NVDA",      name: "NVIDIA",            address: "0x6ceaf0d037e628d8c08e1462f628bde4da633813", decimals: 18, category: "stocks" },
  { symbol: "PLTR",      name: "Palantir",          address: "0x56979c925faa2b84637f2991c31fd6b1b33624b0", decimals: 18, category: "stocks" },
  { symbol: "TSLA",      name: "Tesla",             address: "0x9e2dbb4930607e58401c3f55cbe2e0819a8a0523", decimals: 18, category: "stocks" },
];

// Find a token by address (case-insensitive)
export function getTokenByAddress(address: string): Token | undefined {
  return TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

// Filter by category
export function getTokensByCategory(category: TokenCategory): Token[] {
  return TOKENS.filter((t) => t.category === category);
}

// address → symbol (quick label lookup in the UI)
export const TOKEN_SYMBOL_MAP = Object.fromEntries(
  TOKENS.map((t) => [t.address.toLowerCase(), t.symbol]),
) as Record<string, string>;
