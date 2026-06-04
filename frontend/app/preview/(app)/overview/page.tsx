"use client";

import { useState, useRef, useEffect } from "react";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { TokenIcon, tokenColor } from "@/components/preview/TokenIcon";
import { DepositModal, WithdrawModal } from "@/components/preview/MoneyModals";
import SlidingNumber from "@/components/preview/SlidingNumber";

// bento cards settle in one-by-one on first paint
const BENTO_CONTAINER: Variants = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const BENTO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* ──────────────────────────────────────────────────────────
   Overview page mock — Tends
   Light theme, Aspekta, blue tones. Mercury-inspired.
   ────────────────────────────────────────────────────────── */

// ─── Line chart (portfolio value over time) ─────────────────

const CHART_H = 150;
const PAD = 8;

// 30 days of portfolio value, trending up with variance
const DATA = [
  11800, 11820, 11790, 11850, 11910, 11880, 11950, 12010, 11980, 12060, 12040,
  12110, 12090, 12150, 12200, 12180, 12130, 12090, 12160, 12230, 12280, 12250,
  12310, 12290, 12350, 12330, 12290, 12360, 12410, 12430,
];

// indices where agent rebalanced (markers on the line)
const REBALANCES = [6, 14, 22, 29];

// Catmull-Rom → bezier: smooth curve through the points
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

function PortfolioChart() {
  const ref = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(640);
  const [hoverX, setHoverX] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // measured at the real pixel width — no aspect-ratio stretch (keeps the curve crisp)
  const min = Math.min(...DATA);
  const max = Math.max(...DATA);
  const rng = max - min || 1;
  const nn = DATA.length;
  const pts = DATA.map((v, i) => ({
    x: (i / (nn - 1)) * (w - PAD * 2) + PAD,
    y: CHART_H - PAD - ((v - min) / rng) * (CHART_H - PAD * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[nn - 1].x.toFixed(1)},${CHART_H} L${pts[0].x.toFixed(1)},${CHART_H} Z`;

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

  let hv: { x: number; y: number; value: number; date: string } | null = null;
  if (hoverX !== null) {
    const frac = Math.max(0, Math.min(1, (hoverX - PAD) / (w - PAD * 2)));
    const pos = frac * (nn - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(nn - 1, i0 + 1);
    const value = Math.round(DATA[i0] + (DATA[i1] - DATA[i0]) * (pos - i0));
    hv = {
      x: hoverX,
      y: yAtX(hoverX),
      value,
      date: dateForIndex(Math.round(pos)),
    };
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <svg
        width="100%"
        height={CHART_H}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(
            Math.max(pts[0].x, Math.min(pts[nn - 1].x, e.clientX - rect.left)),
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
            <p className="text-[0.625rem] font-medium text-white/45">
              Portfolio value
            </p>
            <p className="text-sm font-semibold tabular-nums text-white">
              ${hv.value.toLocaleString("en-US")}
            </p>
            <p className="mt-0.5 text-[0.625rem] text-white/50">{hv.date}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PortfolioCard() {
  const [range, setRange] = useState("30D");
  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 lg:col-span-2"
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
          Your Portfolio
        </p>
        <div className="flex gap-0.5 rounded-lg bg-[#F7F9FC] p-0.5">
          {["7D", "30D", "90D", "1Y"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${
                range === r
                  ? "bg-[#EAF4FC] text-[#1591DC]"
                  : "text-[#5B7490] hover:text-[#0C1A2B]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[210px_1fr]">
        <div className="flex flex-col justify-center">
          <p className="text-xs text-[#5B7490]">Total Portfolio Value</p>
          <div className="flex items-end gap-2">
            <p className="mt-1 flex items-center text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[#0C1A2B]">
              <span>$</span>
              <SlidingNumber number={12430.5} decimalPlaces={2} />
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-green-600">
              <TrendingUp className="h-4 w-4" strokeWidth={2.2} /> +5.3%
            </p>
          </div>
          <div className="my-5 h-px bg-[#E8EAEC]" />
          <p className="text-xs text-[#5B7490]">Estimated APY</p>
          <p className="flex items-center text-2xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
            <SlidingNumber number={8.4} decimalPlaces={1} />%
          </p>
        </div>
        <div className="pl-6">
          <PortfolioChart />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Holdings ───────────────────────────────────────────────

const HOLDINGS = [
  {
    sym: "cmETH",
    name: "Mantle LST",
    pct: 40,
    val: 4972,
    delta: "+0.8%",
    bar: "#2C5EAD",
    w: "80%",
    icon: "bg-[#EAF4FC] text-[#2C5EAD]",
  },
  {
    sym: "sUSDe",
    name: "Ethena",
    pct: 35,
    val: 4351,
    delta: "+0.1%",
    bar: "#1591DC",
    w: "70%",
    icon: "bg-[#EAF4FC] text-[#1591DC]",
  },
  {
    sym: "USDC",
    name: "Stablecoin",
    pct: 25,
    val: 3107,
    delta: "—",
    bar: "#4BB8FA",
    w: "50%",
    icon: "bg-[#EAF4FC] text-[#4BB8FA]",
  },
];

function Holdings() {
  const [hover, setHover] = useState<number | null>(null);

  const centerPct =
    hover === null
      ? 0
      : HOLDINGS.slice(0, hover).reduce((s, h) => s + h.pct, 0) +
        HOLDINGS[hover].pct / 2;

  // legend shows only the top 3 holdings (the bar still reflects all of them)
  const shown = HOLDINGS.slice(0, 3);

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
          Your Holdings
        </p>
        <Link
          href="/preview/plan"
          aria-label="Open plan"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      {/* segmented allocation bar — seamless, lightly rounded */}
      <div className="relative">
        <div className="flex h-3.5">
          {HOLDINGS.map((h, i) => (
            <div
              key={h.sym}
              style={{
                flexGrow: h.pct,
                background: tokenColor(h.sym),
                marginLeft: i === 0 ? 0 : -5,
                zIndex: HOLDINGS.length - i,
              }}
              className="relative basis-0 cursor-pointer rounded-[3px]"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>

        {/* hover tooltip */}
        <AnimatePresence>
          {hover !== null && (
            <motion.div
              className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-[#0C1A2B] px-2.5 py-1.5 text-left shadow-lg"
              style={{ left: `${centerPct}%`, transformOrigin: "bottom center" }}
              initial={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <p className="text-xs font-semibold text-white">
                {HOLDINGS[hover].sym}
              </p>
              <p className="text-[0.625rem] text-white/55">
                {HOLDINGS[hover].pct}% · ${HOLDINGS[hover].val.toLocaleString("en-US")} ·{" "}
                {HOLDINGS[hover].name}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* legend (always visible in the bento card) */}
      <div className="mt-3">
        {shown.map((h, i) => (
          <div
            key={h.sym}
            className={`flex items-center gap-3 py-2.5 ${i < shown.length - 1 ? "border-b border-[#E8EAEC]" : ""}`}
          >
            <TokenIcon sym={h.sym} color={tokenColor(h.sym)} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0C1A2B]">{h.sym}</p>
              <p className="text-[0.625rem] text-[#5B7490]">{h.name}</p>
            </div>
            <span className="w-10 text-right text-xs font-medium text-[#5B7490]">
              {h.pct}%
            </span>
            <div className="w-16 text-right">
              <p className="flex items-center justify-end text-sm font-semibold text-[#0C1A2B]">
                <span>$</span>
                <SlidingNumber number={h.val} />
              </p>
              <p
                className={`text-[0.625rem] ${h.delta === "—" ? "text-[#E8EAEC]" : "text-green-600"}`}
              >
                {h.delta}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Your Agent card ────────────────────────────────────────

// type → badge colors, same palette as the Activity page rows
const ACT_TAG: Record<string, string> = {
  Rebalance: "bg-[#EAF4FC] text-[#1591DC]",
  Monitor: "bg-[#EDF2F7] text-[#5B7490]",
};

// most recent agent activity. time = clock if today, else a relative word.
const ACTIVITY = [
  { type: "Rebalance", desc: "Moved 15% cmETH to sUSDe", time: "14:32" },
  { type: "Monitor", desc: "Conditions stable, held steady", time: "11:05" },
  { type: "Rebalance", desc: "Shifted 8% USDC to cmETH", time: "Yesterday" },
];

// agent lifecycle, shown as a single status dot. flip AGENT_STATE to preview.
//   idle    = on, watching your conditions (primary blue, the resting state)
//   running = making a move right now (light blue, softer)
//   paused  = you stopped it (gray)
const AGENT_STATES = {
  idle: { label: "Idle", dot: "bg-[#1591DC]" },
  running: { label: "Running", dot: "bg-[#8CC8EE]" },
  paused: { label: "Paused", dot: "bg-[#B4C0CE]" },
} as const;

const AGENT_STATE: keyof typeof AGENT_STATES = "idle";

function AgentCard() {
  const state = AGENT_STATES[AGENT_STATE];
  const running = AGENT_STATE === "running";
  // animate "Running." → "Running.." → "Running..." while the agent is acting
  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      450,
    );
    return () => clearInterval(id);
  }, [running]);
  return (
    <motion.div
      variants={BENTO_ITEM}
      className="flex flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
            Your Agent
          </p>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${state.dot}`} />
            <span className="text-[0.6875rem] font-medium text-[#5B7490]">
              {state.label}
              {running ? dots : ""}
            </span>
          </span>
        </div>
        <Link
          href="/preview/agent"
          aria-label="Open agent"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3">
          <p className="text-[0.625rem] uppercase tracking-[0.08em] text-[#94A3B8]">
            Risk
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B]">Medium</p>
        </div>
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3">
          <p className="text-[0.625rem] uppercase tracking-[0.08em] text-[#94A3B8]">
            Next run
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B]">
            in 18 min
          </p>
        </div>
      </div>

      <div className="mt-2">
        {ACTIVITY.slice(0, 3).map((a, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 py-2.5 ${i < 2 ? "border-b border-[#E8EAEC]" : ""}`}
          >
            <span
              className={`w-20 shrink-0 rounded-md px-2 py-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider ${ACT_TAG[a.type]}`}
            >
              {a.type}
            </span>
            <span className="flex-1 truncate text-[0.8125rem] text-[#0C1A2B]">
              {a.desc}
            </span>
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-[#94A3B8]">
              {a.time}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function OverviewPreview() {
  const [modal, setModal] = useState<null | "deposit" | "withdraw">(null);
  return (
    <>
      <div className="mx-auto max-w-5xl px-8 py-8">
          {/* title row — actions live up here now */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
                Overview
              </h1>
              <p className="mt-1 text-sm text-[#5B7490]">
                Where your money sits today.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setModal("withdraw")}
                className="rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-4 py-2 text-sm font-medium text-[#5B7490] transition-colors hover:text-[#0C1A2B]"
              >
                Withdraw
              </button>
              <button
                onClick={() => setModal("deposit")}
                className="rounded-full bg-[#1591DC] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Deposit
              </button>
            </div>
          </div>

          {/* three sections: portfolio (full) · holdings + agent.
              two cards in the same grid row stay equal height automatically. */}
          <motion.div
            className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
            initial="hidden"
            animate="show"
            variants={BENTO_CONTAINER}
          >
            <PortfolioCard />
            <Holdings />
            <AgentCard />
          </motion.div>
      </div>
      <DepositModal open={modal === "deposit"} onClose={() => setModal(null)} />
      <WithdrawModal open={modal === "withdraw"} onClose={() => setModal(null)} />
    </>
  );
}
