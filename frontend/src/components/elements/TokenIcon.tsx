/* Shared token icon + logo map for the app.
   Matches the preview version exactly. */

export const LOGO: Record<string, string> = {
  // core / crypto / stable
  USDC: "/tokens/usdc.svg", USDT: "/tokens/usdt.png", cmETH: "/tokens/cmeth.png",
  sUSDe: "/tokens/susde.png", mETH: "/tokens/meth.png", WMNT: "/tokens/wmnt.jpeg",
  USDY: "/tokens/usdy.png",
  // funds
  ONDO: "/tokens/ondo.png", BUIDL: "/tokens/buidl.png", BENJI: "/tokens/benji.png",
  ACRED: "/tokens/acred.png", VBILL: "/tokens/vbill.png",
  // commodities / bonds (XAU/XAG/XPT/XCU/WTI/URANIUM use themed monograms)
  XAUt: "/tokens/xaut.png", CETES: "/tokens/cetes.png", GILTS: "/tokens/gilts.png",
  KTB: "/tokens/ktb.png", TESOURO: "/tokens/tesouro.jpg",
  // fx (flags)
  EUR: "/tokens/eur.svg", GBP: "/tokens/gbp.svg", BRL: "/tokens/brl.svg", JPY: "/tokens/jpy.png",
  IDR: "/tokens/idr.svg", KRW: "/tokens/krw.svg", SGD: "/tokens/sgd.svg", TRY: "/tokens/try.svg",
  // indices (flags)
  KOSPI200: "/tokens/kospi200.svg", NIKKEI225: "/tokens/nikkei225.png",
  USA100: "/tokens/usa100.svg", USA500: "/tokens/usa500.svg",
  // stocks (company logos)
  AAPL: "/tokens/aapl.png", AMZN: "/tokens/amzn.png", GOOGL: "/tokens/googl.png",
  META: "/tokens/meta.png", MSFT: "/tokens/msft.png", NVDA: "/tokens/nvda.png",
  PLTR: "/tokens/pltr.png", TSLA: "/tokens/tsla.png",
};

const CAT_COLOR: Record<string, string> = {
  core: "#1591DC",
  bonds: "#2C5EAD",
  commodities: "#C79A3E",
  funds: "#7C3AED",
  fx: "#16A34A",
  indices: "#5B7490",
  stocks: "#0C1A2B",
};

// Per-token identity color — pulled from each token's logo, monochrome/duplicate
// tones nudged apart so they stay distinct when stacked. Used by allocation bars.
export const TOKEN_COLOR: Record<string, string> = {
  // core
  USDC: "#2775CA", USDT: "#26A17B", mUSD: "#15A6B0", USDY: "#16356B",
  mETH: "#E0405A", cmETH: "#D6308F", sUSDe: "#3A4250", WMNT: "#8A94A6",
  // funds
  ONDO: "#565A5E", BUIDL: "#1E1E20", BENJI: "#0C4A3E", ACRED: "#1F8A5B", VBILL: "#1F4A99",
  // bonds
  CETES: "#6B7A0F", GILTS: "#A8D60C", KTB: "#C6E417", TESOURO: "#7E8A10",
  // commodities (pictogram circle color)
  XAU: "#D4AF37", XAUt: "#D4AF37", XAG: "#9CA3AF", XPT: "#A7B5BD", XCU: "#B87333", WTI: "#1F2937", URANIUM: "#3FA34D",
  // fx (flag dominant)
  EUR: "#003399", GBP: "#012169", BRL: "#009440", JPY: "#BC002D", IDR: "#FF0000", KRW: "#CD2E3A", SGD: "#ED2939", TRY: "#E30A17",
  // indices (flag dominant)
  KOSPI200: "#E03B4A", NIKKEI225: "#D81E3F", USA100: "#B31942", USA500: "#8E1437",
  // stocks
  AAPL: "#3A3A3C", AMZN: "#FF9900", GOOGL: "#4285F4", META: "#0081FB", MSFT: "#F25022", NVDA: "#76B900", PLTR: "#4A5663", TSLA: "#E31937",
};

// resolve a token's color: identity → category → caller fallback
export function tokenColor(sym: string, category?: string, fallback = "#1591DC") {
  return TOKEN_COLOR[sym] ?? (category ? CAT_COLOR[category] ?? fallback : fallback);
}

// commodities = colored circle + white pictogram glyph (more readable than a monogram)
const COMMODITY: Record<string, { color: string; glyph: string }> = {
  XAU: { color: "#D4AF37", glyph: "/tokens/glyph-ingot.svg" },
  XAUt: { color: "#D4AF37", glyph: "/tokens/glyph-ingot.svg" },
  XAG: { color: "#9CA3AF", glyph: "/tokens/glyph-ingot.svg" },
  XPT: { color: "#A7B5BD", glyph: "/tokens/glyph-ingot.svg" },
  XCU: { color: "#B87333", glyph: "/tokens/glyph-ingot.svg" },
  WTI: { color: "#1F2937", glyph: "/tokens/glyph-oil.svg" },
  URANIUM: { color: "#3FA34D", glyph: "/tokens/glyph-radioactive.svg" },
};

export function TokenIcon({
  sym,
  color = "#1591DC",
  category,
  size = 28,
}: {
  sym: string;
  color?: string;
  category?: string;
  size?: number;
}) {
  // commodity pictogram (colored circle + white glyph)
  const c = COMMODITY[sym];
  if (c) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: c.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.glyph} alt={sym} width={size * 0.56} height={size * 0.56} />
      </span>
    );
  }
  const src = LOGO[sym];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={sym} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  const bg = category ? CAT_COLOR[category] ?? color : color;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.32 }}
    >
      {sym.slice(0, 2)}
    </span>
  );
}

// full token universe (symbol + category) for the gallery
export const ALL_TOKENS: { sym: string; category: string }[] = [
  ...["USDC", "USDT", "mUSD", "USDY", "mETH", "cmETH", "sUSDe", "WMNT"].map((sym) => ({ sym, category: "core" })),
  ...["CETES", "GILTS", "KTB", "TESOURO"].map((sym) => ({ sym, category: "bonds" })),
  ...["URANIUM", "WTI", "XAG", "XAU", "XAUt", "XCU", "XPT"].map((sym) => ({ sym, category: "commodities" })),
  ...["ACRED", "BENJI", "BUIDL", "ONDO", "VBILL"].map((sym) => ({ sym, category: "funds" })),
  ...["BRL", "EUR", "GBP", "IDR", "JPY", "KRW", "SGD", "TRY"].map((sym) => ({ sym, category: "fx" })),
  ...["KOSPI200", "NIKKEI225", "USA100", "USA500"].map((sym) => ({ sym, category: "indices" })),
  ...["AAPL", "AMZN", "GOOGL", "META", "MSFT", "NVDA", "PLTR", "TSLA"].map((sym) => ({ sym, category: "stocks" })),
];
