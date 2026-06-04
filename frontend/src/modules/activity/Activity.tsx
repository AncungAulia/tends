"use client";

import { useState, useRef, useEffect } from "react";
import { Search, TrendingUp, ChevronRight, ChevronDown, X, Check, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAccount } from "wagmi";
import SlidingNumber from "@/components/elements/SlidingNumber";
import { useActivity, type ActivityEntry } from "@/hooks/useActivityLog";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useUserVault } from "@/hooks/useUserVault";

/* ──────────────────────────────────────────────────────────
   Activity module — Tends
   Filters · stats + chart · grouped history · detail drawer
   ────────────────────────────────────────────────────────── */

// ─── Types ──────────────────────────────────────────────────

type ActType = "Rebalance" | "Deposit" | "Withdraw" | "Monitor";

const TAG: Record<ActType, string> = {
  Rebalance: "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15 dark:text-[#4BB8FA]",
  Deposit:   "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  Withdraw:  "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  Monitor:   "bg-[#EDF2F7] text-[#5B7490] dark:bg-white/10 dark:text-white/45",
};

function toActType(action: string): ActType {
  switch (action.toUpperCase()) {
    case "REBALANCE": return "Rebalance";
    case "DEPOSIT":   return "Deposit";
    case "WITHDRAW":  return "Withdraw";
    default:          return "Monitor";
  }
}

function impactTone(t: ActType): "pos" | "neg" | "neutral" {
  if (t === "Deposit") return "pos";
  if (t === "Withdraw") return "neg";
  return "neutral";
}

function impactText(entry: ActivityEntry, t: ActType): string {
  const m = entry.metadata;
  if (m && typeof m === "object") {
    const obj = m as Record<string, unknown>;
    if (obj.impact) return String(obj.impact);
    if (obj.amount) {
      const prefix = t === "Withdraw" ? "-$" : "+$";
      return `${prefix}${Number(obj.amount).toLocaleString("en-US")}`;
    }
  }
  if (t === "Rebalance") return "+APY";
  return "—";
}

function dayLabel(ts: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (ts.toDateString() === today.toDateString()) return "Today";
  if (ts.toDateString() === yesterday.toDateString()) return "Yesterday";
  return ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeStr(ts: Date): string {
  return ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Chart ──────────────────────────────────────────────────

const CHART_H = 220;
const PADY = 14;

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

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateChartData(totalAssets: number, n = 30): number[] {
  if (totalAssets <= 0) return Array.from({ length: n }, (_, i) => 1000 + i * 10);
  const rand = mulberry32(Math.round(totalAssets));
  const start = totalAssets * 0.92;
  const arr: number[] = [];
  let v = start;
  for (let i = 0; i < n - 1; i++) {
    v += (rand() - 0.45) * totalAssets * 0.008;
    arr.push(Math.max(start * 0.9, v));
  }
  arr.push(totalAssets);
  return arr;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dateForIndex(i: number, n = 30): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - (n - 1 - i));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function StatsChart({ totalAssets, rebalanceCount, period }: { totalAssets: number; rebalanceCount: number; period: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(680);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const DATA = generateChartData(totalAssets);
  const n = DATA.length;
  const REBALANCES = [Math.floor(n * 0.2), Math.floor(n * 0.47), Math.floor(n * 0.73), n - 2];
  const TICKS = [Math.floor(n * 0.13), Math.floor(n * 0.37), Math.floor(n * 0.6), Math.floor(n * 0.83)];

  const min = Math.min(...DATA);
  const max = Math.max(...DATA);
  const range = max - min || 1;
  const pts = DATA.map((v, i) => ({
    x: (i / (n - 1)) * (w - 8) + 4,
    y: CHART_H - PADY - ((v - min) / range) * (CHART_H - PADY * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[n - 1].x.toFixed(1)},${CHART_H} L${pts[0].x.toFixed(1)},${CHART_H} Z`;

  function yAtX(targetX: number) {
    const path = lineRef.current;
    if (!path) return 0;
    const len = path.getTotalLength();
    let lo = 0; let hi = len;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      if (path.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
    }
    return path.getPointAtLength((lo + hi) / 2).y;
  }

  let hv: { x: number; y: number; value: number; date: string } | null = null;
  if (hoverX !== null) {
    const frac = Math.max(0, Math.min(1, (hoverX - 4) / (w - 8)));
    const pos = frac * (n - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(n - 1, i0 + 1);
    const t = pos - i0;
    const value = Math.round(DATA[i0] + (DATA[i1] - DATA[i0]) * t);
    hv = { x: hoverX, y: yAtX(hoverX), value, date: dateForIndex(Math.round(pos), n) };
  }

  const gain = totalAssets > 0 ? Math.round(totalAssets * 0.055) : 0;

  return (
    <div className="grid grid-cols-1 gap-6 rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 md:grid-cols-[210px_1fr] dark:border-white/8 dark:bg-[#0F2035]">
      <div className="flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#5B7490] dark:text-white/45">Portfolio Value</p>
        <div className="mt-1 flex gap-2">
          <p className="flex items-center text-2xl font-semibold tracking-[-0.04em] text-[#0C1A2B] dark:text-white">
            <span>$</span>
            <SlidingNumber number={Math.round(totalAssets * 100) / 100} decimalPlaces={2} />
          </p>
          {gain > 0 && (
            <p className="flex items-center gap-1 text-sm font-medium text-green-600">
              <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
              <span className="flex items-center">+$<SlidingNumber className="inline-flex" number={gain} /></span>
            </p>
          )}
        </div>
        <p className="text-[11px] text-[#94A3B8] dark:text-white/30">over {period}</p>
        <div className="my-4 h-px bg-[#E3EAF2] dark:bg-white/10" />
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5B7490] dark:text-white/45">Rebalances</span>
            <span className="flex items-center text-sm font-semibold text-[#0C1A2B] dark:text-white">
              <SlidingNumber className="inline-flex" number={rebalanceCount} />
            </span>
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative min-w-0">
        <svg
          width={w} height={CHART_H} className="block"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setHoverX(Math.max(pts[0].x, Math.min(pts[n - 1].x, e.clientX - rect.left)));
          }}
          onMouseLeave={() => setHoverX(null)}
        >
          <defs>
            <linearGradient id="act-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1591DC" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1591DC" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path d={area} fill="url(#act-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }} />
          {TICKS.map((i) => (
            <line key={`g-${i}`} x1={pts[i].x} y1={pts[i].y} x2={pts[i].x} y2={CHART_H - PADY}
              stroke="#5B7490" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
          ))}
          <motion.path ref={lineRef} d={line} fill="none" stroke="#1591DC" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
          />
          {REBALANCES.map((i) => (
            <circle key={i} cx={pts[i].x} cy={pts[i].y} r="3.5" fill="#fff" stroke="#1591DC" strokeWidth="2" />
          ))}
          {hv && (
            <>
              <line x1={hv.x} y1={0} x2={hv.x} y2={CHART_H} stroke="#1591DC" strokeOpacity="0.25" strokeWidth="1" />
              <circle cx={hv.x} cy={hv.y} r="4.5" fill="#1591DC" stroke="#fff" strokeWidth="2" />
            </>
          )}
        </svg>
        <AnimatePresence>
          {hv && (
            <motion.div
              className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-[#0C1A2B] px-3 py-2 text-left shadow-lg"
              style={{ left: Math.max(56, Math.min(w - 56, hv.x)), top: hv.y - 12, transformOrigin: "bottom center" }}
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-100%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-100%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-100%" }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <p className="text-[10px] font-medium text-white/45">Portfolio value</p>
              <p className="text-sm font-semibold tabular-nums text-white">${hv.value.toLocaleString("en-US")}</p>
              <p className="mt-0.5 text-[10px] text-white/50">{hv.date}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative mt-2 h-3.5">
          {TICKS.map((i) => (
            <span key={`t-${i}`} className="absolute -translate-x-1/2 text-[10px] text-[#5B7490] dark:text-white/30" style={{ left: pts[i].x }}>
              {dateForIndex(i, n)}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-center">
          <span className="flex items-center gap-1.5 text-[10px] text-[#5B7490] dark:text-white/45">
            <span className="h-2 w-2 rounded-full border-2 border-[#1591DC] bg-white dark:bg-[#0F2035]" /> Agent rebalanced
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Period dropdown ─────────────────────────────────────────

const PERIODS = ["7 days","30 days","90 days","1 year","All time","Custom range"];

function PeriodDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#0C1A2B] transition-colors hover:border-[#5B7490] dark:border-white/10 dark:bg-white/5 dark:text-white"
      >
        {value}
        <ChevronDown className={`h-3.5 w-3.5 text-[#5B7490] transition-transform dark:text-white/45 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+6px)] z-20 w-36 rounded-xl border-[1.25px] border-[#E8EAEC] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8 dark:border-white/10 dark:bg-[#0F2035]"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#F7F9FC] dark:hover:bg-white/5 ${p === value ? "font-semibold text-[#1591DC] dark:text-[#4BB8FA]" : "text-[#5B7490] dark:text-white/45"}`}
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

// ─── Activity row ─────────────────────────────────────────────

type DisplayAct = {
  id: string;
  day: string;
  time: string;
  type: ActType;
  desc: string;
  impact: string;
  impactTone: "pos" | "neg" | "neutral";
  metadata: unknown;
  txHash?: string;
};

function Row({ a, onClick }: { a: DisplayAct; onClick: () => void }) {
  const impactColor =
    a.impactTone === "pos" ? "text-green-600 dark:text-green-400"
    : a.impactTone === "neg" ? "text-orange-600 dark:text-orange-400"
    : "text-[#94A3B8] dark:text-white/30";
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-[#F7F9FC] dark:hover:bg-white/5"
    >
      <span className="w-12 shrink-0 font-mono text-[11px] text-[#94A3B8] dark:text-white/30">{a.time}</span>
      <span className={`w-24 shrink-0 rounded-md px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${TAG[a.type]}`}>{a.type}</span>
      <span className="flex-1 truncate text-sm text-[#0C1A2B] dark:text-white">{a.desc}</span>
      <span className={`w-24 shrink-0 text-right text-xs font-medium ${impactColor}`}>{a.impact}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#C5D0DC] dark:text-white/20" />
    </button>
  );
}

// ─── Detail drawer ─────────────────────────────────────────────

function Drawer({ act, onClose }: { act: DisplayAct | null; onClose: () => void }) {
  const open = !!act;
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const impactColor =
    act?.impactTone === "pos" ? "text-green-600 dark:text-green-400"
    : act?.impactTone === "neg" ? "text-orange-600 dark:text-orange-400"
    : "text-[#94A3B8] dark:text-white/30";

  function formatMeta(m: unknown): string {
    if (!m) return "";
    if (typeof m === "string") return m;
    try { return JSON.stringify(m, null, 2); } catch { return String(m); }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-[#0C1A2B]/25 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#0F2035] ${open ? "translate-x-0" : "translate-x-full"}`}>
        {act && (
          <>
            <div className="flex items-start justify-between border-b border-[#E8EAEC] p-5 dark:border-white/8">
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TAG[act.type]}`}>
                  {act.type}
                </span>
                <p className="mt-2 text-base font-semibold text-[#0C1A2B] dark:text-white">{act.desc}</p>
                <p className="mt-0.5 text-xs text-[#5B7490] dark:text-white/45">{act.day} · {act.time}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-[1.25px] border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#0C1A2B] hover:text-[#0C1A2B] dark:border-white/10 dark:text-white/45 dark:hover:border-white/20 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className={`text-sm font-semibold ${impactColor}`}>{act.impact}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#94A3B8] dark:text-white/30">
                Details
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#5B7490] dark:text-white/45">Action</span>
                  <span className="text-xs font-medium text-[#0C1A2B] dark:text-white">{act.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#5B7490] dark:text-white/45">Time</span>
                  <span className="text-xs font-medium text-[#0C1A2B] dark:text-white">{act.day} at {act.time}</span>
                </div>
                {act.txHash && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#5B7490] dark:text-white/45">Tx</span>
                    <span className="truncate font-mono text-[10px] text-[#1591DC] dark:text-[#4BB8FA]">{act.txHash}</span>
                  </div>
                )}
              </div>
              {act.metadata != null && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] dark:text-white/30">Metadata</p>
                  <pre className="overflow-x-auto rounded-lg bg-[#F7F9FC] p-3 font-mono text-[11px] text-[#5B7490] dark:bg-white/5 dark:text-white/45">
                    {formatMeta(act.metadata)}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const FILTERS = ["All", "Rebalance", "Deposit", "Withdraw", "Monitor"] as const;

export function Activity() {
  const { address } = useAccount();
  const { vaultAddress } = useUserVault();
  const { totalAssetsUSDC } = usePortfolio(vaultAddress, address);
  const { activities, isLoading } = useActivity();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DisplayAct | null>(null);
  const [period, setPeriod] = useState("30 days");
  const [shown, setShown] = useState(7);

  useEffect(() => { setShown(7); }, [filter, query, period]);

  const displayActivities: DisplayAct[] = activities.map((a) => {
    const t = toActType(a.action);
    return {
      id: a.id,
      day: dayLabel(a.timestamp),
      time: timeStr(a.timestamp),
      type: t,
      desc: a.action === "REBALANCE"
        ? "Rebalanced portfolio"
        : a.action.charAt(0) + a.action.slice(1).toLowerCase() + " event",
      impact: impactText(a, t),
      impactTone: impactTone(t),
      metadata: a.metadata,
      txHash: a.txHash,
    };
  });

  const rebalanceCount = displayActivities.filter((a) => a.type === "Rebalance").length;

  const filtered = displayActivities.filter(
    (a) =>
      (filter === "All" || a.type === filter) &&
      a.desc.toLowerCase().includes(query.toLowerCase()),
  );
  const visible = filtered.slice(0, shown);
  const days = [...new Set(visible.map((a) => a.day))];

  return (
    <>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B] dark:text-white">Activity</h1>
            <p className="mt-1 text-sm text-[#5B7490] dark:text-white/45">Every move the agent and you have made.</p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodDropdown value={period} onChange={setPeriod} />
            <button className="flex items-center gap-1.5 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3.5 py-1.5 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] dark:border-white/10 dark:bg-white/5 dark:text-white/45">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="mb-6">
          <StatsChart totalAssets={totalAssetsUSDC} rebalanceCount={rebalanceCount} period={period.toLowerCase()} />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-[#1591DC] bg-[#EAF4FC] text-[#1591DC] dark:border-[#4BB8FA]/50 dark:bg-[#1591DC]/15 dark:text-[#4BB8FA]"
                    : "border-[#E8EAEC] bg-white text-[#5B7490] hover:text-[#0C1A2B] dark:border-white/10 dark:bg-white/5 dark:text-white/45 dark:hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-3 py-1.5 focus-within:border-[#1591DC] dark:border-white/10 dark:bg-white/5">
            <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity"
              className="w-36 bg-transparent text-xs text-[#0C1A2B] outline-none placeholder:text-[#94A3B8] dark:text-white"
            />
          </div>
        </div>

        <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-2 dark:border-white/8 dark:bg-[#0F2035]">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-[#E8EAEC] dark:bg-white/10" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8] dark:text-white/30">
              {activities.length === 0 ? "No activity yet." : "No activity matches your filter."}
            </p>
          ) : (
            days.map((day) => (
              <motion.div
                key={day}
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
              >
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] dark:text-white/30">
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

        {filtered.length > 0 && (
          <div className="mt-4 flex justify-center">
            {shown < filtered.length ? (
              <button
                onClick={() => setShown((s) => s + 6)}
                className="rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-5 py-2 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] dark:border-white/10 dark:bg-white/5 dark:text-white/45"
              >
                Load more
              </button>
            ) : (
              <p className="text-[11px] text-[#94A3B8] dark:text-white/30">You&apos;re all caught up</p>
            )}
          </div>
        )}

        <div className="h-12" />
      </div>

      <Drawer act={selected} onClose={() => setSelected(null)} />
    </>
  );
}
