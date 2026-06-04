import { TokenIcon, ALL_TOKENS } from "@/components/preview/TokenIcon";

export const metadata = { title: "Token colors — Tends" };

/* ──────────────────────────────────────────────────────────
   Token color comparison — Tends
   Brand raw → Brand tuned → Curated
   "tuned" = brand-anchored, but co-occurring siblings nudged
   apart in tone so the stacked bar stays legible.
   ────────────────────────────────────────────────────────── */

const CAT: Record<string, string> = Object.fromEntries(ALL_TOKENS.map((t) => [t.sym, t.category]));

const CAT_FALLBACK: Record<string, string> = {
  core: "#1591DC", bonds: "#2C5EAD", commodities: "#C79A3E",
  funds: "#7C3AED", fx: "#16A34A", indices: "#5B7490", stocks: "#0C1A2B",
};

// ① BRAND (raw) — real brand colors where known, else category fallback.
//    The Mantle family (mUSD/mETH/cmETH/WMNT) all collapse to mint → the clash.
const BRAND: Record<string, string> = {
  USDC: "#2775CA", USDT: "#26A17B",
  mUSD: "#4AB6A8", mETH: "#4AB6A8", cmETH: "#2E8B84", WMNT: "#4AB6A8",
  USDY: "#1F3A8A", sUSDe: "#26262B",
  ONDO: "#2B5CE6", BUIDL: "#1A1A1A", BENJI: "#007A33", VBILL: "#003DA5",
  XAU: "#D4AF37", XAUt: "#C79A3E", XAG: "#9CA3AF", XPT: "#A7B5BD", XCU: "#B87333", WTI: "#1F2937", URANIUM: "#3FA34D",
  AAPL: "#111827", AMZN: "#FF9900", GOOGL: "#4285F4", META: "#0866FF",
  MSFT: "#00A4EF", NVDA: "#76B900", PLTR: "#101113", TSLA: "#E31937",
};

// ② FROM ICON — color pulled from each token's own logo (extracted from the files).
//    Monochrome logos got a neutral; WMNT nudged off sUSDe so High stays legible.
//    mUSD has no logo (monogram) → assigned teal. Commodities use their pictogram color.
const TUNED: Record<string, string> = {
  // core
  USDC: "#2775CA", USDT: "#26A17B", mUSD: "#15A6B0", USDY: "#16356B",
  mETH: "#E0405A", cmETH: "#D6308F", sUSDe: "#3A4250", WMNT: "#8A94A6",
  // funds (ONDO/BUIDL mono → spread in tone so they stay distinct if held together)
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

// ③ FULLY CURATED — designed palette, max contrast (reference).
const CURATED: Record<string, string> = {
  USDC: "#2775CA", USDT: "#26A17B", mUSD: "#3B82F6", USDY: "#6366F1",
  mETH: "#8B5CF6", cmETH: "#06B6D4", sUSDe: "#EC4899", WMNT: "#F59E0B",
  CETES: "#65A30D", GILTS: "#16A34A", KTB: "#0D9488", TESOURO: "#84CC16",
  URANIUM: "#3FA34D", WTI: "#374151", XAG: "#9CA3AF", XAU: "#D4AF37", XAUt: "#C79A3E", XCU: "#B87333", XPT: "#A7B5BD",
  ACRED: "#C026D3", BENJI: "#9333EA", BUIDL: "#4F46E5", ONDO: "#7C3AED", VBILL: "#A855F7",
  BRL: "#16A34A", EUR: "#2563EB", GBP: "#DC2626", IDR: "#EF4444", JPY: "#E11D48", KRW: "#0EA5E9", SGD: "#F43F5E", TRY: "#B91C1C",
  KOSPI200: "#0EA5E9", NIKKEI225: "#E11D48", USA100: "#2563EB", USA500: "#4F46E5",
  AAPL: "#111827", AMZN: "#FF9900", GOOGL: "#4285F4", META: "#0866FF", MSFT: "#00A4EF", NVDA: "#76B900", PLTR: "#101113", TSLA: "#E31937",
};

function brandOf(sym: string) {
  return BRAND[sym] ?? CAT_FALLBACK[CAT[sym]] ?? "#1591DC";
}
type SchemeKey = "brand" | "tuned" | "curated";
function colorFor(scheme: SchemeKey, sym: string) {
  if (scheme === "brand") return brandOf(sym);
  if (scheme === "tuned") return TUNED[sym] ?? brandOf(sym);
  return CURATED[sym] ?? CAT_FALLBACK[CAT[sym]];
}

type Scheme = { key: SchemeKey; name: string; note: string };
const SCHEMES: Scheme[] = [
  { key: "brand", name: "Brand (raw)", note: "Brand colors. Mantle family collapses to one mint." },
  { key: "tuned", name: "From icon", note: "Color from each token's own logo. Mono logos get a neutral." },
  { key: "curated", name: "Fully curated", note: "Designed palette, max contrast. Reference only." },
];

type Alloc = { sym: string; pct: number };
const STRATEGIES: { id: string; alloc: Alloc[] }[] = [
  { id: "Low", alloc: [{ sym: "mUSD", pct: 90 }, { sym: "USDY", pct: 10 }] },
  { id: "Medium", alloc: [{ sym: "mUSD", pct: 40 }, { sym: "mETH", pct: 30 }, { sym: "cmETH", pct: 30 }] },
  { id: "High", alloc: [{ sym: "cmETH", pct: 40 }, { sym: "sUSDe", pct: 30 }, { sym: "mETH", pct: 20 }, { sym: "WMNT", pct: 10 }] },
];

function Bar({ alloc, scheme }: { alloc: Alloc[]; scheme: SchemeKey }) {
  return (
    <div>
      <div className="flex h-3.5">
        {alloc.map((a, i) => (
          <div
            key={a.sym}
            style={{ flexGrow: a.pct, background: colorFor(scheme, a.sym), marginLeft: i === 0 ? 0 : -5, zIndex: alloc.length - i }}
            className="relative basis-0 rounded-[3px]"
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
        {alloc.map((a) => (
          <span key={a.sym} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(scheme, a.sym) }} />
            <span className="font-semibold text-[#0C1A2B]">{a.sym}</span>
            <span className="text-[#5B7490]">{a.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES = ["core", "bonds", "commodities", "funds", "fx", "indices", "stocks"];
const CAT_LABEL: Record<string, string> = {
  core: "Core / Crypto / Stable", bonds: "Bonds", commodities: "Commodities",
  funds: "Funds", fx: "FX", indices: "Indices", stocks: "Stocks",
};

export default function TokensComparison() {
  return (
    <div className="min-h-screen bg-[#F9FBFC] text-[#0C1A2B]">
      <div className="mx-auto max-w-5xl px-8 py-12">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Token colors</h1>
        <p className="mt-1 text-sm text-[#5B7490]">
          Color each token from its own logo, with neutrals for black/white icons. Compare on the real strategies below.
        </p>

        {/* ─── A. on the real strategies ─── */}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SCHEMES.map((s) => (
            <div
              key={s.key}
              className={`rounded-2xl border-[1.25px] bg-white p-5 ${
                s.key === "tuned" ? "border-[#1591DC]/40 ring-1 ring-[#1591DC]/15" : "border-[#E8EAEC]"
              }`}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#0C1A2B]">{s.name}</p>
                {s.key === "tuned" && (
                  <span className="rounded-full bg-[#EAF4FC] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#1591DC]">
                    Pick
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-[#5B7490]">{s.note}</p>
              <div className="mt-5 space-y-5">
                {STRATEGIES.map((st) => (
                  <div key={st.id}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{st.id}</p>
                    <Bar alloc={st.alloc} scheme={s.key} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 rounded-xl bg-[#EAF4FC]/50 px-4 py-3 text-xs leading-relaxed text-[#5B7490]">
          <span className="font-semibold text-[#0C1A2B]">From icon</span> takes each slice&apos;s color straight from its logo, so the bar
          echoes the legend icons. mETH reads red, cmETH pink. The only manual call: sUSDe &amp; WMNT logos are black/white, so they get
          distinct neutral tones instead of both going black.
        </p>

        {/* ─── B. full swatch set ─── */}
        <h2 className="mt-12 text-lg font-semibold tracking-tight">All 44 tokens</h2>
        <p className="mt-0.5 text-sm text-[#5B7490]">Raw · From icon · Curated swatch per token.</p>

        {CATEGORIES.map((cat) => {
          const tokens = ALL_TOKENS.filter((t) => t.category === cat);
          return (
            <section key={cat} className="mt-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">{CAT_LABEL[cat]}</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {tokens.map((t) => (
                  <div key={t.sym} className="flex items-center gap-3 rounded-xl border-[1.25px] border-[#E8EAEC] bg-white px-4 py-2.5">
                    <TokenIcon sym={t.sym} category={t.category} size={28} />
                    <span className="flex-1 truncate text-sm font-semibold text-[#0C1A2B]">{t.sym}</span>
                    <div className="flex gap-1">
                      {(["brand", "tuned", "curated"] as const).map((sc) => (
                        <span
                          key={sc}
                          title={sc}
                          className="h-5 w-5 rounded-md border border-black/5"
                          style={{ background: colorFor(sc, t.sym) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <div className="mt-8 text-[11px] text-[#5B7490]">swatch order: Raw · From icon · Curated</div>
      </div>
    </div>
  );
}
