"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  TokenIcon,
  tokenColor,
  ALL_TOKENS,
} from "@/components/preview/TokenIcon";
import ExclusionField from "@/components/preview/ExclusionField";
import SlidingNumber from "@/components/preview/SlidingNumber";

/* ──────────────────────────────────────────────────────────
   Plan page mock — Tends
   Left: strategy tabs + breakdown + switch
   Right: projection (inputs → allocation → cases → chart)
   ────────────────────────────────────────────────────────── */

// ─── Strategy data ──────────────────────────────────────────

type Alloc = { sym: string; pct: number };
type Strat = {
  id: string;
  apy: number | null;
  vol: number;
  risk: string;
  riskCls: string;
  desc: string;
  hold: string;
  drop: string;
  bestFor: string;
  alloc: Alloc[];
};

const STRATEGIES: Strat[] = [
  {
    id: "Low",
    apy: 5.1,
    vol: 0.03,
    risk: "Low",
    riskCls: "bg-green-50 text-green-700 border-green-200",
    desc: "Built to keep your capital steady.",
    hold: "No minimum",
    drop: "under 1%",
    bestFor: "Parking capital",
    alloc: [
      { sym: "mUSD", pct: 90 },
      { sym: "USDY", pct: 10 },
    ],
  },
  {
    id: "Medium",
    apy: 8.4,
    vol: 0.14,
    risk: "Medium",
    riskCls: "bg-yellow-50 text-yellow-700 border-yellow-200",
    desc: "Balanced growth, without the full market swing.",
    hold: "3+ months",
    drop: "around 5%",
    bestFor: "Steady growth",
    alloc: [
      { sym: "mUSD", pct: 40 },
      { sym: "mETH", pct: 30 },
      { sym: "cmETH", pct: 30 },
    ],
  },
  {
    id: "High",
    apy: 12.3,
    vol: 0.28,
    risk: "High",
    riskCls: "bg-red-50 text-red-600 border-red-200",
    desc: "Chases the most upside, rides the swings.",
    hold: "1+ year",
    drop: "around 12%",
    bestFor: "Long horizon",
    alloc: [
      { sym: "cmETH", pct: 40 },
      { sym: "sUSDe", pct: 30 },
      { sym: "mETH", pct: 20 },
      { sym: "WMNT", pct: 10 },
    ],
  },
  {
    id: "Custom",
    apy: null,
    vol: 0.14,
    risk: "Custom",
    riskCls: "bg-[#EAF4FC] text-[#1591DC] border-[#1591DC]/20",
    desc: "Your own mix, held on target by the agent.",
    hold: "—",
    drop: "—",
    bestFor: "Fine control",
    alloc: [],
  },
];

const CURRENT = "Medium";
const LVL_HINT: Record<string, string> = {
  Low: "safe",
  Medium: "balanced",
  High: "aggressive",
};
const DURATIONS = [
  { label: "3 months", years: 0.25 },
  { label: "6 months", years: 0.5 },
  { label: "1 year", years: 1 },
  { label: "3 years", years: 3 },
  { label: "5 years", years: 5 },
  { label: "10 years", years: 10 },
];

function fmtUSD(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// projection: expected / best / worst end value.
// uncertainty widens with sqrt(time) and is capped, so worst-case can dip below
// the starting amount short-term (esp. higher vol) but heals over long horizons.
function project(capital: number, apy: number, vol: number, years: number) {
  const base = capital * Math.pow(1 + apy / 100, years);
  const spread = Math.min(0.5, vol * Math.sqrt(years));
  return { base, best: base * (1 + spread), worst: base * (1 - spread) };
}

// ─── Growth chart (measured area) ───────────────────────────

const CH = 150;
const CP = 12;

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] || p2;
    d += ` C${p1.x + (p2.x - p0.x) / 8},${p1.y + (p2.y - p0.y) / 8} ${p2.x - (p3.x - p1.x) / 8},${p2.y - (p3.y - p1.y) / 8} ${p2.x},${p2.y}`;
  }
  return d;
}

const SCOLORS: Record<string, string> = {
  likely: "#1591DC",
  best: "#16A34A",
  worst: "#EF4444",
};

// deterministic PRNG so the simulated path is stable across renders
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s: string) {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return h;
}

function GrowthChart({
  capital,
  apy,
  vol,
  years,
  mode,
  seed,
}: {
  capital: number;
  apy: number;
  vol: number;
  years: number;
  mode: string;
  seed: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hoverX, setHoverX] = useState<number | null>(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const proj = project(capital, apy, vol, years);
  const targetFor = (k: string) =>
    k === "best" ? proj.best : k === "worst" ? proj.worst : proj.base;

  // deterministic simulated path per scenario: capital → that scenario's end value.
  // the END is the real projected figure; the wiggle in between is illustrative volatility.
  const n = 60;
  const simVals = (k: string) => {
    const tgt = targetFor(k);
    const ratio = capital > 0 ? tgt / capital : 1;
    const rand = mulberry32(strSeed(`${seed}-${k}`) + Math.round(years * 100));
    const arr: number[] = [];
    let dev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      dev = dev * 0.86 + (rand() - 0.5) * vol * 0.6;
      const wnd = Math.sin(Math.PI * t);
      arr.push(capital * Math.pow(ratio, t) * (1 + dev * wnd));
    }
    arr[0] = capital;
    arr[n - 1] = tgt;
    return arr;
  };

  const valsByKey: Record<string, number[]> = {
    likely: simVals("likely"),
    best: simVals("best"),
    worst: simVals("worst"),
  };

  // scenarios to draw + draw order (hero last / on top)
  const active = mode === "all" ? ["worst", "best", "likely"] : [mode];
  const pool = active.flatMap((k) => valsByKey[k]).concat([capital]);
  const min = Math.min(...pool);
  const max = Math.max(...pool);
  const range = max - min || 1;
  const toPts = (vals: number[]) =>
    vals.map((v, i) => ({
      x: (i / (n - 1)) * (w - 16) + 8,
      y: CH - CP - ((v - min) / range) * (CH - CP * 2),
    }));
  const ptsByKey: Record<string, { x: number; y: number }[]> = {};
  for (const k of active) ptsByKey[k] = toPts(valsByKey[k]);

  const capY = CH - CP - ((capital - min) / range) * (CH - CP * 2);

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const isAll = mode === "all";
  const fillOp = isAll ? "0.09" : "0.18";
  const impliedPct = isAll
    ? null
    : (
        (Math.pow(targetFor(mode) / (capital || 1), 1 / Math.max(years, 1e-6)) -
          1) *
        100
      ).toFixed(1);

  // hover readout (linear interpolation along the sampled path)
  let hv: {
    x: number;
    when: string;
    rows: { k: string; v: number; y: number }[];
  } | null = null;
  if (hoverX !== null) {
    const frac = Math.max(0, Math.min(1, (hoverX - 8) / (w - 16)));
    const pos = frac * (n - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(n - 1, i0 + 1);
    const t = pos - i0;
    const months = Math.round(frac * years * 12);
    const when =
      months <= 0
        ? "today"
        : months >= 12
          ? `in ${(months / 12).toFixed(months % 12 ? 1 : 0)}y`
          : `in ${months}mo`;
    const rows = active.map((k) => {
      const vv = valsByKey[k];
      const pp = ptsByKey[k];
      return {
        k,
        v: vv[i0] + (vv[i1] - vv[i0]) * t,
        y: pp[i0].y + (pp[i1].y - pp[i0].y) * t,
      };
    });
    hv = { x: hoverX, when, rows };
  }

  return (
    <div>
      <div ref={wrapRef} className="relative min-w-0">
        <svg
          width={w}
          height={CH}
          className="block"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHoverX(Math.max(8, Math.min(w - 8, e.clientX - r.left)));
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          <defs>
            {(["likely", "best", "worst"] as const).map((k) => (
              <linearGradient
                key={k}
                id={`gsim-${k}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={SCOLORS[k]} stopOpacity={fillOp} />
                <stop offset="100%" stopColor={SCOLORS[k]} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {/* break-even line (starting capital) */}
          <line
            x1={8}
            y1={capY}
            x2={w - 8}
            y2={capY}
            stroke="#94A3B8"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {active.map((k) => {
            const pts = ptsByKey[k];
            const path = smooth(pts);
            const area = `${path} L${pts[n - 1].x},${CH} L${pts[0].x},${CH} Z`;
            return (
              <g key={k}>
                <motion.path
                  d={area}
                  fill={`url(#gsim-${k})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                />
                <motion.path
                  d={path}
                  fill="none"
                  stroke={SCOLORS[k]}
                  strokeWidth={!isAll || k === "likely" ? 2.5 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                />
                <circle
                  cx={pts[n - 1].x}
                  cy={pts[n - 1].y}
                  r="4"
                  fill="#fff"
                  stroke={SCOLORS[k]}
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {hv && (
            <>
              <line
                x1={hv.x}
                y1={0}
                x2={hv.x}
                y2={CH}
                stroke="#5B7490"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              {hv.rows.map((r) => (
                <circle
                  key={r.k}
                  cx={hv.x}
                  cy={r.y}
                  r="4"
                  fill="#fff"
                  stroke={SCOLORS[r.k]}
                  strokeWidth="2"
                />
              ))}
            </>
          )}
        </svg>
        <AnimatePresence>
          {hv && (
            <motion.div
              className="pointer-events-none absolute whitespace-nowrap rounded-lg bg-[#0C1A2B] px-2.5 py-1.5 text-left shadow-lg"
              style={{
                left: Math.max(46, Math.min(w - 46, hv.x)),
                top: 0,
                transformOrigin: "top center",
              }}
              initial={{ opacity: 0, scale: 0.9, y: -4, x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: -4, x: "-50%" }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <p className="text-[10px] text-white/55">{hv.when}</p>
              {hv.rows.map((r) => (
                <p
                  key={r.k}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: SCOLORS[r.k] }}
                  />
                  {isAll ? `${cap(r.k)} ` : ""}
                  {fmtUSD(r.v)}
                </p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#94A3B8]">
        <span>
          {impliedPct !== null
            ? `Projected approximately at ${impliedPct}%/year`
            : "Projected range, based on current yields"}
        </span>
        {/* fine-print disclaimer, tucked behind an info icon */}
        <span className="group relative inline-flex">
          <button
            aria-label="About this projection"
            className="flex h-3 w-3 items-center justify-center rounded-full border border-[#CBD5E1] text-[8px] font-semibold leading-none text-[#94A3B8] transition-colors hover:border-[#5B7490] hover:text-[#5B7490]"
          >
            i
          </button>
          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-lg bg-[#0C1A2B] px-2.5 py-1.5 text-[10px] leading-snug text-white/80 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Estimate from current yields and typical volatility. Actual results
            will vary.
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── Duration dropdown (presets, styled like Activity) ──────

type Dur = { label: string; years: number };

function DurationDropdown({
  value,
  onChange,
}: {
  value: Dur;
  onChange: (d: Dur) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#0C1A2B] transition-colors hover:border-[#5B7490]"
      >
        {value.label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#5B7490] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+6px)] z-20 w-36 rounded-xl border-[1.25px] border-[#E8EAEC] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8"
          >
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F7F9FC] ${
                  d.label === value.label
                    ? "font-semibold text-[#1591DC]"
                    : "text-[#5B7490]"
                }`}
              >
                {d.label}
                {d.label === value.label && <Check className="h-3 w-3" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function PlanPage() {
  const [selectedId, setSelectedId] = useState(CURRENT);
  const [capital, setCapital] = useState(12430);
  const [duration, setDuration] = useState(DURATIONS[2]);
  const [allocHover, setAllocHover] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState("all");
  const [customW, setCustomW] = useState({ Low: 40, Medium: 40, High: 20 });
  const [avoid, setAvoid] = useState<string[]>([]);

  const strat = STRATEGIES.find((s) => s.id === selectedId)!;
  const isCurrent = selectedId === CURRENT;
  const isCustom = strat.apy === null;

  // custom = blend the three preset strategies by the user's weights
  const customTotal = customW.Low + customW.Medium + customW.High;
  const customValid = customTotal === 100;
  const blended = (() => {
    const norm = customTotal || 1;
    let bApy = 0;
    let bVol = 0;
    const tokenMap: Record<string, number> = {};
    for (const lvl of ["Low", "Medium", "High"] as const) {
      const s = STRATEGIES.find((x) => x.id === lvl)!;
      const f = customW[lvl] / norm;
      bApy += (s.apy ?? 0) * f;
      bVol += s.vol * f;
      for (const a of s.alloc)
        tokenMap[a.sym] = (tokenMap[a.sym] ?? 0) + a.pct * f;
    }
    const alloc = Object.entries(tokenMap)
      .map(([sym, pct]) => ({ sym, pct: Math.round(pct) }))
      .filter((a) => a.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    return { apy: bApy, vol: bVol, alloc };
  })();

  const apy = isCustom ? blended.apy : (strat.apy ?? 0);
  const vol = isCustom ? blended.vol : strat.vol;
  const baseAlloc = isCustom ? blended.alloc : strat.alloc;
  // exclusions are a composition constraint: drop avoided tokens, renormalize the rest
  const alloc = (() => {
    const kept = baseAlloc.filter((a) => !avoid.includes(a.sym));
    const sum = kept.reduce((s, a) => s + a.pct, 0) || 1;
    return kept.map((a) => ({ ...a, pct: Math.round((a.pct / sum) * 100) }));
  })();
  const { base, best, worst } = project(capital, apy, vol, duration.years);

  // hovered allocation segment → tooltip ($ derived from capital)
  const ah =
    allocHover !== null && allocHover < alloc.length ? alloc[allocHover] : null;
  const allocCenter = ah
    ? alloc.slice(0, allocHover!).reduce((s, a) => s + a.pct, 0) + ah.pct / 2
    : 0;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Plan</h1>
          <p className="mt-1 text-sm text-[#5B7490]">
            Compare strategies and project forward.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-4 py-2 text-sm font-medium text-[#5B7490] transition-colors hover:text-[#0C1A2B]">
            <MessageSquare className="h-4 w-4" /> Ask Agent
          </button>
          {!isCurrent && (
            <button className="rounded-full bg-[#1591DC] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              {isCustom ? "Set custom mix" : `Switch to ${strat.id}`}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ─── LEFT: strategy ─── */}
        <div className="flex flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
          {/* role header */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
            Strategy
          </p>
          <p className="mb-4 mt-0.5 text-xs text-[#5B7490]">
            Pick one to preview its mix and projection.
          </p>

          {/* tabs — bordered segmented control */}
          <div className="flex">
            {STRATEGIES.map((s, i) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`relative flex-1 border-[1.25px] border-[#E8EAEC] px-2 py-2 text-xs font-medium transition-colors ${
                    i === 0 ? "rounded-l-lg" : "ml-[-1.25px]"
                  } ${i === STRATEGIES.length - 1 ? "rounded-r-lg" : ""} ${
                    active
                      ? "z-10 border-[#1591DC] bg-[#EAF4FC] font-semibold text-[#1591DC]"
                      : "bg-white text-[#5B7490] hover:bg-[#F7F9FC]"
                  }`}
                >
                  {s.id}
                </button>
              );
            })}
          </div>

          {/* header */}
          <div className="mt-5 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[#0C1A2B]">
                {isCustom ? "Custom" : `${strat.id} Risk`}
              </h2>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
                  {isCustom
                    ? `${apy.toFixed(1)}%`
                    : strat.apy != null
                      ? `${strat.apy}%`
                      : "—"}
                </span>
                <span className="text-[10px] tracking-wider text-[#94A3B8]">
                  estimated APY
                </span>
              </p>
            </div>
            {isCurrent && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#5B7490]">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Current
              </span>
            )}
          </div>

          {isCustom ? (
            /* custom: user sets the mix across risk levels */
            <div className="mt-4 flex flex-1 flex-col">
              <p className="mb-1 text-xs text-[#5B7490]">
                How much in each risk?
              </p>
              <div className="flex flex-1 flex-col justify-center">
                {(["Low", "Medium", "High"] as const).map((lvl) => (
                  <div
                    key={lvl}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-[#0C1A2B]">
                        {lvl} Risk
                      </span>
                      {/* <span className="text-[10px] text-[#94A3B8]">
                            {LVL_HINT[lvl]}
                          </span> */}
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border-[1.25px] border-[#E8EAEC] bg-white px-2.5 py-1.5 transition-all focus-within:border-[#1591DC] focus-within:ring-2 focus-within:ring-[#1591DC]/15">
                      <input
                        value={customW[lvl]}
                        onChange={(e) =>
                          setCustomW((p) => ({
                            ...p,
                            [lvl]: Math.min(
                              100,
                              Number(e.target.value.replace(/\D/g, "")) || 0,
                            ),
                          }))
                        }
                        inputMode="numeric"
                        className="w-8 bg-transparent text-right text-sm font-semibold text-[#0C1A2B] outline-none"
                      />
                      <span className="text-xs text-[#5B7490]">%</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* receipt-style total: divider line + sum */}
              <div className="mt-3 border-t-[1.25px] border-[#E8EAEC] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#0C1A2B]">
                    Total
                  </span>
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <span
                      className={
                        customValid ? "text-[#0C1A2B]" : "text-[#EF4444]"
                      }
                    >
                      {customTotal}%
                    </span>
                    {customValid && (
                      <Check
                        className="h-3.5 w-3.5 text-green-600"
                        strokeWidth={2.5}
                      />
                    )}
                  </span>
                </div>
                {!customValid && (
                  <p className="mt-1 text-right text-[10px] text-[#EF4444]">
                    Must equal 100%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* description */}
              <p className="mt-4 text-sm leading-relaxed text-[#5B7490]">
                {strat.desc}
              </p>

              {/* characteristics — grows to fill so columns match height without a void */}
              <div className="mt-5 flex flex-1 flex-col justify-around overflow-hidden rounded-xl bg-[#F7F9FC] py-1">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-[#5B7490]">Time to keep</span>
                  <span className="text-xs font-semibold text-[#0C1A2B]">
                    {strat.hold}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-[#5B7490]">
                    Possible worst drop
                  </span>
                  <span className="text-xs font-semibold text-[#0C1A2B]">
                    {strat.drop}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-[#5B7490]">
                    Best suited for
                  </span>
                  <span className="text-xs font-semibold text-[#0C1A2B]">
                    {strat.bestFor}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Avoid — composition constraint, lives with the strategy */}
          <div className="mt-5 border-t border-[#E8EAEC] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
              Avoid
            </p>
            <p className="mb-3 mt-0.5 text-xs text-[#5B7490]">
              Assets the agent will never hold. Your mix adjusts around them.
            </p>
            <ExclusionField
              selected={avoid}
              onChange={setAvoid}
              options={ALL_TOKENS.map((t) => ({
                value: t.sym,
                cat: t.category,
              }))}
              searchable
              searchHint="Search assets"
              renderIcon={(v, cat) => (
                <TokenIcon sym={v} category={cat} size={16} />
              )}
            />
          </div>
        </div>

        {/* ─── RIGHT: projection ─── */}
        <div className="flex flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
          {/* role header */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
            Projection
          </p>
          <p className="mb-4 mt-0.5 text-xs text-[#5B7490]">
            {isCustom
              ? "See what your mix could do with your money."
              : `See what ${strat.id} could do with your money.`}
          </p>

          {/* inputs */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                Capital
              </label>
              <div className="mt-1 flex items-center gap-1 rounded-lg border-[1.25px] border-[#E8EAEC] bg-white px-3 py-1.5 transition-all focus-within:border-[#1591DC] focus-within:ring-2 focus-within:ring-[#1591DC]/15">
                <span className="text-sm text-[#5B7490]">$</span>
                <input
                  value={capital ? capital.toLocaleString("en-US") : ""}
                  onChange={(e) =>
                    setCapital(Number(e.target.value.replace(/\D/g, "")) || 0)
                  }
                  inputMode="numeric"
                  className="w-24 bg-transparent text-sm font-semibold text-[#0C1A2B] outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                From your balance
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                Duration
              </label>
              <div className="mt-1">
                <DurationDropdown value={duration} onChange={setDuration} />
              </div>
            </div>
          </div>

          {isCustom && !customValid ? (
            <div className="mt-6 rounded-xl bg-[#F7F9FC] py-12 text-center">
              <p className="text-sm font-medium text-[#0C1A2B]">
                Weights must total 100%
              </p>
              <p className="mt-1 text-xs text-[#5B7490]">
                You&apos;re at {customTotal}%. Adjust the mix on the left.
              </p>
            </div>
          ) : (
            <>
              {/* allocation — what it buys */}
              <div className="mt-6">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
                  Allocation
                </p>
                <div className="relative">
                  <div className="flex h-3.5">
                    {alloc.map((a, i) => (
                      <div
                        key={a.sym}
                        style={{
                          flexGrow: a.pct,
                          background: tokenColor(a.sym),
                          marginLeft: i === 0 ? 0 : -5,
                          zIndex: alloc.length - i,
                        }}
                        className="relative basis-0 cursor-pointer rounded-[3px] transition-[flex-grow] duration-500 ease-out"
                        onMouseEnter={() => setAllocHover(i)}
                        onMouseLeave={() => setAllocHover(null)}
                      />
                    ))}
                  </div>
                  <AnimatePresence>
                    {ah && (
                      <motion.div
                        className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-[#0C1A2B] px-2.5 py-1.5 text-left shadow-lg"
                        style={{
                          left: `${allocCenter}%`,
                          transformOrigin: "bottom center",
                        }}
                        initial={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                      >
                        <p className="text-xs font-semibold text-white">
                          {ah.sym}
                        </p>
                        <p className="text-[10px] text-white/55">
                          {ah.pct}% · {fmtUSD((capital * ah.pct) / 100)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {alloc.map((a) => (
                    <div key={a.sym} className="flex items-center gap-2">
                      <TokenIcon
                        sym={a.sym}
                        color={tokenColor(a.sym)}
                        size={22}
                      />
                      <span className="text-sm font-semibold text-[#0C1A2B]">
                        {a.sym}
                      </span>
                      <span className="text-xs text-[#5B7490]">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* growth — principal vs projected earnings (Likely) */}
              <div className="mt-6">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
                  Growth
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-xs text-[#5B7490]">
                    {fmtUSD(capital)}
                  </span>
                  <span className="text-xs font-medium text-[#1591DC]">
                    +{fmtUSD(Math.max(0, base - capital))} earned
                  </span>
                </div>
                <div className="mt-2 flex h-3.5">
                  <div
                    style={{ flexGrow: capital, zIndex: 2 }}
                    className="relative basis-0 rounded-[3px] bg-[#CFE3F4] transition-[flex-grow] duration-500 ease-out"
                  />
                  <div
                    style={{
                      flexGrow: Math.max(0, base - capital),
                      marginLeft: -5,
                      zIndex: 1,
                    }}
                    className="relative basis-0 rounded-[3px] bg-[#1591DC] transition-[flex-grow] duration-500 ease-out"
                  />
                </div>
              </div>

              {/* flexible spacer: absorbs leftover slack so the card has no dead bottom */}
              <div className="mt-6 flex-1" />

              {/* lead line + scenarios */}
              <p className="text-xs text-[#5B7490]">
                In {duration.label}, your{" "}
                <span className="font-medium text-[#0C1A2B]">
                  {fmtUSD(capital)}
                </span>{" "}
                could be worth
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {[
                  { label: "Likely", val: base },
                  { label: "Best", val: best },
                  { label: "Worst", val: worst },
                ].map((c) => {
                  const g = c.val - capital;
                  const gp = capital ? (c.val / capital - 1) * 100 : 0;
                  const up = g >= 0;
                  return (
                    <div
                      key={c.label}
                      className="rounded-xl bg-[#F7F9FC] p-3.5"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-[#5B7490]">
                        {c.label}
                      </p>
                      <p className="mt-1 flex items-center text-xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
                        <span>$</span>
                        <SlidingNumber number={Math.round(c.val)} />
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-medium ${up ? "text-green-600" : "text-[#EF4444]"}`}
                      >
                        {up ? "+" : "-"}
                        <span>$</span>
                        <SlidingNumber
                          className="inline-flex"
                          number={Math.round(Math.abs(g))}
                        />
                        <span className="mx-1.5 font-normal text-[#94A3B8]">
                          |
                        </span>
                        {up ? "+" : "-"}
                        {Math.abs(gp).toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── chart — full-width row below, matches Overview chart card ─── */}
      {(!isCustom || customValid) && (
        <div className="mt-5 rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
                Projected growth
              </p>
              <p className="mt-1 text-xs text-[#5B7490]">
                {strat.id} strategy · next{" "}
                <span className="font-medium text-[#0C1A2B]">
                  {duration.label}
                </span>
              </p>
            </div>
            {/* focus toggle */}
            <div className="flex gap-1">
              {(["all", "likely", "best", "worst"] as const).map((m) => {
                const active = chartMode === m;
                const col =
                  m === "best"
                    ? "#16A34A"
                    : m === "worst"
                      ? "#EF4444"
                      : "#1591DC";
                return (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    style={
                      active
                        ? {
                            borderColor: col,
                            color: col,
                            background: col + "14",
                          }
                        : undefined
                    }
                    className={`rounded-full border-[1.25px] px-3 py-1 text-[11px] font-medium capitalize transition-colors ${
                      active
                        ? ""
                        : "border-[#E8EAEC] text-[#5B7490] hover:text-[#0C1A2B]"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <GrowthChart
            capital={capital}
            apy={apy}
            vol={vol}
            years={duration.years}
            mode={chartMode}
            seed={
              isCustom
                ? `Custom-${customW.Low}-${customW.Medium}-${customW.High}`
                : strat.id
            }
          />
        </div>
      )}

      <div className="h-12" />
    </div>
  );
}
