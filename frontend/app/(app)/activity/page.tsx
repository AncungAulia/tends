"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SlidingNumber from "@/components/preview/SlidingNumber";

/* ──────────────────────────────────────────────────────────
   Activity page mock — Tends
   Filters · portfolio chart (with agent action markers) · full history
   ────────────────────────────────────────────────────────── */

// ─── Chart (portfolio value + agent action markers) ─────────

const DATA = [
  11800, 11820, 11790, 11850, 11910, 11880, 11950, 12010, 11980, 12060, 12040,
  12110, 12090, 12150, 12200, 12180, 12130, 12090, 12160, 12230, 12280, 12250,
  12310, 12290, 12350, 12330, 12290, 12360, 12410, 12430,
];
const REBALANCES = [6, 14, 22, 29];
const TICKS = [4, 11, 18, 25]; // x-axis date ticks (inner, weekly-ish)
const CHART_H = 220;
const PADY = 14;

// Catmull-Rom → bezier: smooth line through the points
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 8;
    const c1y = p1.y + (p2.y - p0.y) / 8;
    const c2x = p2.x - (p3.x - p1.x) / 8;
    const c2y = p2.y - (p3.y - p1.y) / 8;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function Stat({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tone?: "pos" | "neg";
}) {
  const c =
    tone === "pos"
      ? "text-green-600"
      : tone === "neg"
        ? "text-orange-600"
        : "text-[#0C1A2B]";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#5B7490]">{label}</span>
      <span className={`flex items-center text-sm font-semibold ${c}`}>
        {prefix}
        <SlidingNumber className="inline-flex" number={value} decimalPlaces={decimals} />
        {suffix}
      </span>
    </div>
  );
}

function StatsChart({ period }: { period: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(680);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) =>
      setW(entries[0].contentRect.width),
    );
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // compute points at the real pixel width — no aspect-ratio stretch
  const min = Math.min(...DATA);
  const max = Math.max(...DATA);
  const range = max - min || 1;
  const n = DATA.length;
  const pts = DATA.map((v, i) => ({
    x: (i / (n - 1)) * (w - 8) + 4,
    y: CHART_H - PADY - ((v - min) / range) * (CHART_H - PADY * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[n - 1].x.toFixed(1)},${CHART_H} L${pts[0].x.toFixed(1)},${CHART_H} Z`;

  // exact y on the smooth curve at a given x (binary search by path length)
  function yAtX(targetX: number) {
    const path = lineRef.current;
    if (!path) return 0;
    const len = path.getTotalLength();
    let lo = 0;
    let hi = len;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).x < targetX) lo = mid;
      else hi = mid;
    }
    return path.getPointAtLength((lo + hi) / 2).y;
  }

  // derive hover readout
  let hv: { x: number; y: number; value: number; date: string } | null = null;
  if (hoverX !== null) {
    const frac = Math.max(0, Math.min(1, (hoverX - 4) / (w - 8)));
    const pos = frac * (n - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(n - 1, i0 + 1);
    const t = pos - i0;
    const value = Math.round(DATA[i0] + (DATA[i1] - DATA[i0]) * t);
    hv = {
      x: hoverX,
      y: yAtX(hoverX),
      value,
      date: dateForIndex(Math.round(pos)),
    };
  }

  return (
    <div className="grid grid-cols-1 gap-6 rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 md:grid-cols-[210px_1fr]">
      {/* left: stats */}
      <div className="flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490]">
          Portfolio Value
        </p>
        <div className="mt-1 flex gap-2">
          <p className="flex items-center text-2xl font-semibold tracking-[-0.04em] text-[#0C1A2B]">
            <span>$</span>
            <SlidingNumber number={12430.5} decimalPlaces={2} />
          </p>
          <p className="flex items-center gap-1 text-sm font-medium text-green-600">
            <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
            <span className="flex items-center">
              +$<SlidingNumber className="inline-flex" number={630} />
            </span>
          </p>
        </div>
        <p className="text-[11px] text-[#94A3B8]">over {period}</p>

        <div className="my-4 h-px bg-[#E3EAF2]" />

        <div className="space-y-2.5">
          <Stat label="Rebalances" value={12} />
          <Stat label="Deposited" value={2500} prefix="+$" tone="pos" />
          <Stat label="Withdrawn" value={500} prefix="-$" tone="neg" />
        </div>
      </div>

      {/* right: chart */}
      <div ref={wrapRef} className="relative min-w-0">
        <svg
          width={w}
          height={CHART_H}
          className="block"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoverX(
              Math.max(pts[0].x, Math.min(pts[n - 1].x, e.clientX - rect.left)),
            );
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1591DC" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1591DC" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={area}
            fill="url(#fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          />

          {/* vertical drop-lines: only as tall as the value at that tick, dashed */}
          {TICKS.map((i) => (
            <line
              key={`grid-${i}`}
              x1={pts[i].x}
              y1={pts[i].y}
              x2={pts[i].x}
              y2={CHART_H - PADY}
              stroke="#5B7490"
              strokeOpacity="0.25"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ))}
          <motion.path
            ref={lineRef}
            d={line}
            fill="none"
            stroke="#1591DC"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />
          {REBALANCES.map((i) => (
            <circle
              key={i}
              cx={pts[i].x}
              cy={pts[i].y}
              r="3.5"
              fill="#fff"
              stroke="#1591DC"
              strokeWidth="2"
            />
          ))}
          {hv && (
            <>
              <line
                x1={hv.x}
                y1={0}
                x2={hv.x}
                y2={CHART_H}
                stroke="#1591DC"
                strokeOpacity="0.25"
                strokeWidth="1"
              />
              <circle
                cx={hv.x}
                cy={hv.y}
                r="4.5"
                fill="#1591DC"
                stroke="#fff"
                strokeWidth="2"
              />
            </>
          )}
        </svg>
        <AnimatePresence>
          {hv && (
            <motion.div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-[#0C1A2B] px-3 py-2 text-left shadow-lg"
              style={{
                left: Math.max(56, Math.min(w - 56, hv.x)),
                top: hv.y - 12,
                transformOrigin: "bottom center",
              }}
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-100%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-100%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-100%" }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <p className="text-[10px] font-medium text-white/45">
                Portfolio value
              </p>
              <p className="text-sm font-semibold tabular-nums text-white">
                ${hv.value.toLocaleString("en-US")}
              </p>
              <p className="mt-0.5 text-[10px] text-white/50">{hv.date}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {/* x-axis date ticks */}
        <div className="relative mt-2 h-3.5">
          {TICKS.map((i) => (
            <span
              key={`tick-${i}`}
              className="absolute -translate-x-1/2 text-[10px] text-[#5B7490]"
              style={{ left: pts[i].x }}
            >
              {dateForIndex(i)}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-center">
          <span className="flex items-center gap-1.5 text-[10px] text-[#5B7490]">
            <span className="h-2 w-2 rounded-full border-2 border-[#1591DC] bg-white" />{" "}
            Agent rebalanced
          </span>
        </div>
      </div>
    </div>
  );
}

const PERIODS = [
  "7 days",
  "30 days",
  "90 days",
  "1 year",
  "All time",
  "Custom range",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}
// chart data starts May 3; map a point index to its date label
function dateForIndex(i: number) {
  let day = 3 + i;
  let month = 5;
  while (day > DIM[month - 1]) {
    day -= DIM[month - 1];
    month++;
  }
  return `${MONTHS[month - 1]} ${day}`;
}

function PeriodDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
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
        {value}
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
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F7F9FC] ${
                p === value ? "font-semibold text-[#1591DC]" : "text-[#5B7490]"
              }`}
            >
              {p}
              {p === value && <Check className="h-3 w-3" />}
            </button>
          ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Activity data ──────────────────────────────────────────

type Step = { tag: string; msg: string; detail: string };

type Act = {
  id: number;
  day: string;
  time: string;
  type: "Rebalance" | "Deposit" | "Withdraw" | "Monitor";
  desc: string;
  impact: string;
  impactTone?: "pos" | "neutral" | "neg";
  steps?: Step[]; // agent runs (Rebalance / Monitor)
  reasoning?: string; // user transactions (Deposit / Withdraw)
};

const TAG: Record<Act["type"], string> = {
  Rebalance: "bg-[#EAF4FC] text-[#1591DC]",
  Deposit: "bg-green-50 text-green-700",
  Withdraw: "bg-red-50 text-red-600",
  Monitor: "bg-[#EDF2F7] text-[#5B7490]",
};

const STEP_TAG: Record<string, string> = {
  SCAN: "bg-[#EDF2F7] text-[#5B7490]",
  SIGNAL: "bg-[#EAF4FC] text-[#2C5EAD]",
  ANALYZE: "bg-[#EAF4FC] text-[#1591DC]",
  DECIDE: "bg-[#EAF4FC] text-[#1591DC]",
  EXEC: "bg-[#EAF4FC] text-[#1591DC]",
  DONE: "bg-green-50 text-green-700",
};

const REBALANCE_STEPS: Step[] = [
  {
    tag: "SCAN",
    msg: "Checked the latest prices on your holdings",
    detail:
      "Pulled the latest oracle prices. cmETH $3,241, sUSDe $1.001, USDC $1.00. Nothing stale, moved on to check for drift.",
  },
  {
    tag: "SIGNAL",
    msg: "cmETH is swinging more than usual (+12.4%)",
    detail:
      "cmETH's 7-day volatility climbed 12.4% above its 30-day average, a sign of more short-term downside risk.",
  },
  {
    tag: "SIGNAL",
    msg: "sUSDe is paying a better yield (4.2%)",
    detail:
      "sUSDe's yield widened to 4.2% APY, up from 3.6%, making it the natural place to rotate into.",
  },
  {
    tag: "ANALYZE",
    msg: "Checked against your rules, all clear",
    detail:
      "MEDIUM risk, 50% cap per asset, your notes say lean conservative near month-end. The move fits all of it.",
  },
  {
    tag: "DECIDE",
    msg: "Decided to move 15% from cmETH into sUSDe",
    detail:
      "Lowers volatility exposure while capturing the better yield. Confidence 87%, both signals agree.",
  },
  {
    tag: "EXEC",
    msg: "Made the swap on-chain",
    detail:
      "Built and broadcast the swap. Gas ~0.0003 MNT. tx 0x8c1b...3f9e confirmed.",
  },
  {
    tag: "DONE",
    msg: "Rebalanced, est. APY up +0.3%",
    detail:
      "Portfolio rebalanced. I'll keep watching cmETH and rotate back if volatility settles.",
  },
];

const MONITOR_STEPS: Step[] = [
  {
    tag: "SCAN",
    msg: "Checked the latest prices on your holdings",
    detail: "Routine scheduled scan of all held assets.",
  },
  {
    tag: "ANALYZE",
    msg: "Everything within target, nothing to adjust",
    detail:
      "No asset had drifted past the threshold and volatility was normal.",
  },
  {
    tag: "DONE",
    msg: "No action needed, all good",
    detail: "Next scheduled check in about an hour.",
  },
];

const ACTIVITY: Act[] = [
  {
    id: 1,
    day: "Today",
    time: "14:32",
    type: "Rebalance",
    desc: "Moved 15% cmETH to sUSDe",
    impact: "+0.3% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 2,
    day: "Today",
    time: "11:05",
    type: "Monitor",
    desc: "Checked the market, everything stable",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 3,
    day: "Today",
    time: "09:00",
    type: "Monitor",
    desc: "Morning scan, no action needed",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 4,
    day: "Yesterday",
    time: "18:44",
    type: "Rebalance",
    desc: "Shifted 8% USDC to cmETH",
    impact: "+0.6% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 5,
    day: "Yesterday",
    time: "13:30",
    type: "Withdraw",
    desc: "Withdrew $500 USDC",
    impact: "-$500",
    impactTone: "neg",
    reasoning:
      "You withdrew $500. I sold proportionally across your assets to fund it, keeping your target allocation intact afterward.",
  },
  {
    id: 6,
    day: "Yesterday",
    time: "10:15",
    type: "Deposit",
    desc: "Received $500 USDC",
    impact: "+$500",
    impactTone: "pos",
    reasoning:
      "You deposited $500 USDC. I held it as stable and folded it into the next rebalance to keep your target allocation.",
  },
  {
    id: 7,
    day: "May 31",
    time: "16:20",
    type: "Rebalance",
    desc: "Trimmed mETH exposure by 10%",
    impact: "+0.2% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 8,
    day: "May 31",
    time: "08:00",
    type: "Monitor",
    desc: "Daily scan complete",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 9,
    day: "May 30",
    time: "17:10",
    type: "Rebalance",
    desc: "Rotated 12% sUSDe to cmETH",
    impact: "+0.4% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 10,
    day: "May 30",
    time: "12:00",
    type: "Monitor",
    desc: "Midday check, all within target",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 11,
    day: "May 30",
    time: "08:00",
    type: "Monitor",
    desc: "Morning scan, no action needed",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 12,
    day: "May 29",
    time: "20:05",
    type: "Rebalance",
    desc: "Moved 6% WMNT to mETH",
    impact: "+0.1% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 13,
    day: "May 29",
    time: "14:48",
    type: "Deposit",
    desc: "Received $1,000 USDC",
    impact: "+$1,000",
    impactTone: "pos",
    reasoning:
      "You deposited $1,000 USDC. I held it as stable and folded it into the next rebalance to keep your target allocation.",
  },
  {
    id: 14,
    day: "May 29",
    time: "09:30",
    type: "Monitor",
    desc: "Conditions stable, holding",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 15,
    day: "May 28",
    time: "19:22",
    type: "Rebalance",
    desc: "Shifted 9% cmETH to USDC",
    impact: "+0.2% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 16,
    day: "May 28",
    time: "11:00",
    type: "Monitor",
    desc: "Volatility normal, holding",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 17,
    day: "May 27",
    time: "16:40",
    type: "Rebalance",
    desc: "Added 7% to sUSDe for yield",
    impact: "+0.5% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 18,
    day: "May 27",
    time: "10:10",
    type: "Withdraw",
    desc: "Withdrew $300 USDC",
    impact: "-$300",
    impactTone: "neg",
    reasoning:
      "You withdrew $300. I sold proportionally across your assets to fund it, keeping your target allocation intact afterward.",
  },
  {
    id: 19,
    day: "May 27",
    time: "08:00",
    type: "Monitor",
    desc: "Daily scan complete",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 20,
    day: "May 26",
    time: "18:15",
    type: "Rebalance",
    desc: "Trimmed mETH by 5%",
    impact: "+0.1% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 21,
    day: "May 26",
    time: "09:45",
    type: "Monitor",
    desc: "Morning scan, no action needed",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
  {
    id: 22,
    day: "May 25",
    time: "21:30",
    type: "Rebalance",
    desc: "Rotated into cmETH on the dip",
    impact: "+0.3% APY",
    impactTone: "pos",
    steps: REBALANCE_STEPS,
  },
  {
    id: 23,
    day: "May 25",
    time: "13:05",
    type: "Deposit",
    desc: "Received $1,000 USDC",
    impact: "+$1,000",
    impactTone: "pos",
    reasoning:
      "You deposited $1,000 USDC. I held it as stable and folded it into the next rebalance to keep your target allocation.",
  },
  {
    id: 24,
    day: "May 25",
    time: "08:00",
    type: "Monitor",
    desc: "Daily scan complete",
    impact: "—",
    impactTone: "neutral",
    steps: MONITOR_STEPS,
  },
];

const FILTERS = ["All", "Rebalance", "Deposit", "Withdraw", "Monitor"] as const;

const STEP_DOT: Record<string, string> = {
  SCAN: "#C5D0DC",
  SIGNAL: "#2C5EAD",
  ANALYZE: "#1591DC",
  DECIDE: "#1591DC",
  EXEC: "#1591DC",
  DONE: "#16A34A",
};

// ─── Activity row (clickable → opens drawer) ────────────────

function Row({ a, onClick }: { a: Act; onClick: () => void }) {
  const impactColor =
    a.impactTone === "pos"
      ? "text-green-600"
      : a.impactTone === "neg"
        ? "text-orange-600"
        : "text-[#94A3B8]";
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[#F7F9FC]"
    >
      <span className="w-12 shrink-0 font-mono text-[11px] text-[#94A3B8]">
        {a.time}
      </span>
      <span
        className={`w-24 shrink-0 rounded-md px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${TAG[a.type]}`}
      >
        {a.type}
      </span>
      <span className="flex-1 truncate text-sm text-[#0C1A2B]">{a.desc}</span>
      <span
        className={`w-24 shrink-0 text-right text-xs font-medium ${impactColor}`}
      >
        {a.impact}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#C5D0DC]" />
    </button>
  );
}

// ─── Detail drawer (slides in from the right) ───────────────

function Drawer({ act, onClose }: { act: Act | null; onClose: () => void }) {
  const open = !!act;
  // lock page scroll while the drawer is open → only the drawer scrolls
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  const impactColor =
    act?.impactTone === "pos"
      ? "text-green-600"
      : act?.impactTone === "neg"
        ? "text-orange-600"
        : "text-[#94A3B8]";
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[#0C1A2B]/25 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* panel */}
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {act && (
          <>
            <div className="flex items-start justify-between border-b border-[#E8EAEC] p-5">
              <div>
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG[act.type]}`}
                >
                  {act.type}
                </span>
                <p className="mt-2 text-base font-semibold text-[#0C1A2B]">
                  {act.desc}
                </p>
                <p className="mt-0.5 text-xs text-[#5B7490]">
                  {act.day} · {act.time}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-[1.25px] border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#0C1A2B] hover:text-[#0C1A2B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className={`text-sm font-semibold ${impactColor}`}>
                  {act.impact}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {act.steps ? (
                <>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                    How it happened
                  </p>
                  <div>
                    {act.steps.map((s, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: STEP_DOT[s.tag] }}
                          />
                          {i < act.steps!.length - 1 && (
                            <span className="my-1 w-px flex-1 bg-[#E3EAF2]" />
                          )}
                        </div>
                        <div
                          className={`flex-1 ${i < act.steps!.length - 1 ? "pb-5" : ""}`}
                        >
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${STEP_TAG[s.tag]}`}
                          >
                            {s.tag}
                          </span>
                          <p className="mt-1.5 text-sm text-[#0C1A2B]">
                            {s.msg}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#5B7490]">
                            {s.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                    Details
                  </p>
                  <p className="text-sm leading-relaxed text-[#5B7490]">
                    {act.reasoning}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Act | null>(null);
  const [period, setPeriod] = useState("30 days");
  const [from, setFrom] = useState("2026-05-01");
  const [to, setTo] = useState("2026-05-15");
  const [shown, setShown] = useState(7);
  // reset how many rows are shown when the view changes
  useEffect(() => {
    setShown(7);
  }, [filter, query, period]);

  const periodLabel =
    period === "Custom range"
      ? `${fmtDate(from)} – ${fmtDate(to)}`
      : period.toLowerCase();

  const filtered = ACTIVITY.filter(
    (a) =>
      (filter === "All" || a.type === filter) &&
      a.desc.toLowerCase().includes(query.toLowerCase()),
  );
  const visible = filtered.slice(0, shown);
  const days = [...new Set(visible.map((a) => a.day))];

  return (
    <>
      <div className="mx-auto max-w-5xl px-8 py-8">
          {/* Header: title + period + export */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
                Activity
              </h1>
              <p className="mt-1 text-sm text-[#5B7490]">
                Every move the agent and you have made.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {period === "Custom range" && (
                <div className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3 py-1">
                  <span className="text-[11px] font-medium text-[#94A3B8]">
                    From
                  </span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="bg-transparent text-xs text-[#0C1A2B] outline-none [color-scheme:light]"
                  />
                  <span className="text-[11px] font-medium text-[#94A3B8]">
                    to
                  </span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="bg-transparent text-xs text-[#0C1A2B] outline-none [color-scheme:light]"
                  />
                </div>
              )}
              <PeriodDropdown value={period} onChange={setPeriod} />
              <button className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]">
                <Download className="h-3.5 w-3.5" /> Export
              </button>
            </div>
          </div>

          {/* Stats + chart */}
          <div className="mb-6">
            <StatsChart period={periodLabel} />
          </div>

          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? "border-[#1591DC] bg-[#EAF4FC] text-[#1591DC]"
                      : "border-[#E8EAEC] bg-white text-[#5B7490] hover:text-[#0C1A2B]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3 py-1.5 focus-within:border-[#1591DC]">
              <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activity"
                className="w-36 bg-transparent text-xs text-[#0C1A2B] outline-none placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* History table */}
          <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#94A3B8]">
                No activity matches your filter.
              </p>
            ) : (
              days.map((day) => (
                <motion.div
                  key={day}
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                >
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                    {day}
                  </p>
                  {visible
                    .filter((a) => a.day === day)
                    .map((a) => (
                      <motion.div
                        key={a.id}
                        variants={{
                          hidden: { opacity: 0, y: 8 },
                          show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                        }}
                      >
                        <Row a={a} onClick={() => setSelected(a)} />
                      </motion.div>
                    ))}
                </motion.div>
              ))
            )}
          </div>

          {/* load more / end of history */}
          {filtered.length > 0 && (
            <div className="mt-4 flex justify-center">
              {shown < filtered.length ? (
                <button
                  onClick={() => setShown((s) => s + 6)}
                  className="rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-5 py-2 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
                >
                  Load more
                </button>
              ) : (
                <p className="text-[11px] text-[#94A3B8]">
                  You&apos;re all caught up
                </p>
              )}
            </div>
          )}

          <div className="h-12" />
      </div>

      <Drawer act={selected} onClose={() => setSelected(null)} />
    </>
  );
}
