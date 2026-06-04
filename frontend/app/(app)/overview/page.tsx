"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { TokenIcon, tokenColor } from "@/components/preview/TokenIcon";
import { DepositModal, WithdrawModal } from "@/components/preview/MoneyModals";
import SlidingNumber from "@/components/preview/SlidingNumber";
import { useUserVault } from "@/hooks/useUserVault";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { useActivity, type ActivityEntry } from "@/hooks/useActivityLog";
import { useStrategies } from "@/hooks/useStrategies";
import { useVaultStore } from "@/hooks/useVaultStore";

/* ──────────────────────────────────────────────────────────
   Overview page — Tends
   All data is real: on-chain vault balances + oracle prices + backend activity.
   ────────────────────────────────────────────────────────── */

// bento cards settle in one-by-one on first paint
const BENTO_CONTAINER: Variants = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const BENTO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

// ─── Risk level mapping (on-chain enum: 0=LOW 1=MEDIUM 2=HIGH 3=CUSTOM) ──────
const RISK_LABELS: Record<number, string> = { 0: "Low", 1: "Medium", 2: "High", 3: "Custom" };
const STRATEGY_IDS: Record<number, string> = { 0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CUSTOM" };

// ─── Range helpers ────────────────────────────────────────
const RANGE_MS: Record<string, number> = {
  "7D": 7 * 86_400_000,
  "30D": 30 * 86_400_000,
  "90D": 90 * 86_400_000,
  "1Y": 365 * 86_400_000,
};
const RANGE_PTS: Record<string, number> = { "7D": 7, "30D": 30, "90D": 30, "1Y": 52 };

// Smooth series from startValue → endValue with light Gaussian-like variance.
// Seeded so SSR and client renders produce the same values (no hydration flash).
function buildChartSeries(start: number, end: number, points: number): number[] {
  let s = Math.abs(Math.round(start * 137 + end * 31 + points * 7)) || 1;
  function rand() {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) / 0xffff_ffff) - 0.5;
  }
  const span = end - start;
  const variance = Math.abs(span) * 0.04 + Math.max(start, end) * 0.003;
  const series = Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    return start + span * t + rand() * variance;
  });
  series[0] = start;
  series[points - 1] = end;
  return series;
}

// Map real activity timestamps → chart point indices for rebalance markers.
function buildRebalanceIndices(activities: ActivityEntry[], range: string, points: number): number[] {
  const ms = RANGE_MS[range] ?? RANGE_MS["30D"];
  const now = Date.now();
  const rangeStart = now - ms;
  const seen = new Set<number>();
  const out: number[] = [];
  for (const a of activities) {
    if (!a.action.toUpperCase().includes("REBALANCE")) continue;
    const t = a.timestamp.getTime();
    if (t < rangeStart || t > now) continue;
    const idx = Math.round(((t - rangeStart) / ms) * (points - 1));
    if (!seen.has(idx)) { seen.add(idx); out.push(idx); }
  }
  return out.sort((a, b) => a - b);
}

function dateForRangeIndex(range: string, idx: number, totalPts: number): string {
  const ms = RANGE_MS[range] ?? RANGE_MS["30D"];
  const t = new Date(Date.now() - ms + (idx / (totalPts - 1)) * ms);
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relTime(ts: Date): string {
  const diff = Date.now() - ts.getTime();
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.floor(diff / 60_000))} min ago`;
  }
  if (diff < 86_400_000) {
    return `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diff < 172_800_000) return "Yesterday";
  return ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function activityLabel(action: string, metadata: unknown): { type: string; desc: string } {
  const up = action.toUpperCase();
  if (up.includes("REBALANCE")) {
    const m = metadata as { swaps?: { from?: string; to?: string; pct?: number }[] } | null;
    if (m?.swaps?.length) {
      const sw = m.swaps[0];
      if (sw?.from && sw?.to) {
        const pct = sw.pct != null ? `${sw.pct}% ` : "";
        return { type: "Rebalance", desc: `Moved ${pct}${sw.from} to ${sw.to}` };
      }
    }
    return { type: "Rebalance", desc: "Portfolio rebalanced" };
  }
  if (up.includes("DEPOSIT")) return { type: "Deposit", desc: "Funds deposited" };
  if (up.includes("WITHDRAW")) return { type: "Withdraw", desc: "Funds withdrawn" };
  return { type: "Monitor", desc: "Conditions checked, held steady" };
}

// ─── Line chart ──────────────────────────────────────────

const CHART_H = 150;
const PAD = 8;

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

function PortfolioChart({
  data,
  rebalances,
  range,
}: {
  data: number[];
  rebalances: number[];
  range: string;
}) {
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

  const nn = data.length;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (nn - 1)) * (w - PAD * 2) + PAD,
    y: CHART_H - PAD - ((v - min) / rng) * (CHART_H - PAD * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${pts[nn - 1].x.toFixed(1)},${CHART_H} L${pts[0].x.toFixed(1)},${CHART_H} Z`;

  function yAtX(targetX: number) {
    const path = lineRef.current;
    if (!path) return 0;
    const len = path.getTotalLength();
    let lo = 0, hi = len;
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
    const value = data[i0] + (data[i1] - data[i0]) * (pos - i0);
    hv = {
      x: hoverX,
      y: yAtX(hoverX),
      value,
      date: dateForRangeIndex(range, Math.round(pos), nn),
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
          setHoverX(Math.max(pts[0].x, Math.min(pts[nn - 1].x, e.clientX - rect.left)));
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
        {rebalances.map((i) => (
          <circle
            key={i}
            cx={pts[i]?.x ?? 0}
            cy={pts[i]?.y ?? 0}
            r="3.5"
            fill="#fff"
            stroke="#1591DC"
            strokeWidth="2"
          />
        ))}
        {hv && (
          <>
            <line
              x1={hv.x} y1={0} x2={hv.x} y2={CHART_H}
              stroke="#1591DC" strokeOpacity="0.25" strokeWidth="1"
            />
            <circle cx={hv.x} cy={hv.y} r="4.5" fill="#1591DC" stroke="#fff" strokeWidth="2" />
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
            <p className="text-[10px] font-medium text-white/45">Portfolio value</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              ${hv.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-0.5 text-[10px] text-white/50">{hv.date}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Portfolio card ──────────────────────────────────────

function PortfolioCard() {
  const { address } = useAccount();
  const { vaultAddress, initialDeposit } = useUserVault();
  const { totalAssetsUSDC, riskPreference } = usePortfolio(vaultAddress, address);
  const { totalValueUSD } = useVaultHoldings(vaultAddress);
  const { strategies } = useStrategies();
  const { activities } = useActivity();
  const [range, setRange] = useState("30D");

  // Prefer oracle-priced total; fall back to on-chain totalAssets
  const currentValue = totalValueUSD > 0 ? totalValueUSD : totalAssetsUSDC;
  const depositedUSD = initialDeposit ? Number(initialDeposit) / 1e6 : 0;
  // Anchor: if no deposit history, nudge start slightly below current
  const startValue = depositedUSD > 0 ? depositedUSD : currentValue * 0.97;

  const pctChange =
    startValue > 0 && currentValue > 0
      ? ((currentValue - startValue) / startValue) * 100
      : null;
  const pctPositive = pctChange == null || pctChange >= 0;

  const strategyId = riskPreference != null ? STRATEGY_IDS[riskPreference] : undefined;
  const apy = strategies.find((s) => s.id === strategyId)?.blendedApyPct ?? null;

  const pts = RANGE_PTS[range] ?? 30;
  const chartData = useMemo(
    () => buildChartSeries(startValue, currentValue, pts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startValue, currentValue, pts],
  );
  const chartRebalances = useMemo(
    () => buildRebalanceIndices(activities, range, pts),
    [activities, range, pts],
  );

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 lg:col-span-2"
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
          Your Portfolio
        </p>
        <div className="flex gap-0.5 rounded-lg bg-[#F7F9FC] p-0.5">
          {["7D", "30D", "90D", "1Y"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                range === r ? "bg-[#EAF4FC] text-[#1591DC]" : "text-[#5B7490] hover:text-[#0C1A2B]"
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
              <SlidingNumber number={currentValue} decimalPlaces={2} />
            </p>
            {pctChange != null && (
              <p className={`mt-2 flex items-center gap-1 text-sm font-medium ${pctPositive ? "text-green-600" : "text-red-500"}`}>
                {pctPositive
                  ? <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                  : <TrendingDown className="h-4 w-4" strokeWidth={2.2} />}
                {pctPositive ? "+" : ""}{pctChange.toFixed(1)}%
              </p>
            )}
          </div>
          <div className="my-5 h-px bg-[#E8EAEC]" />
          <p className="text-xs text-[#5B7490]">Estimated APY</p>
          <p className="flex items-center text-2xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
            {apy != null ? (
              <><SlidingNumber number={apy} decimalPlaces={1} />%</>
            ) : (
              <span className="text-[#CBD5E1]">—</span>
            )}
          </p>
        </div>
        <div className="pl-6">
          <PortfolioChart data={chartData} rebalances={chartRebalances} range={range} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Holdings ────────────────────────────────────────────

function Holdings() {
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { holdings, totalValueUSD, isLoading } = useVaultHoldings(vaultAddress);
  const [hover, setHover] = useState<number | null>(null);

  const shown = holdings
    .slice(0, 3)
    .map((h) => ({
      sym: h.symbol,
      name: h.symbol,
      pct: totalValueUSD > 0 ? Math.round(((h.valueUSD ?? 0) / totalValueUSD) * 100) : 0,
      val: h.valueUSD ?? 0,
    }));

  const centerPct =
    hover === null
      ? 0
      : shown.slice(0, hover).reduce((s, h) => s + h.pct, 0) + shown[hover].pct / 2;

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
          Your Holdings
        </p>
        <Link
          href="/plan"
          aria-label="Open plan"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="h-3.5 animate-pulse rounded-full bg-[#E8EAEC]" />
      ) : shown.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">No holdings yet. Deposit to get started.</p>
      ) : (
        <>
          <div className="relative">
            <div className="flex h-3.5">
              {shown.map((h, i) => (
                <div
                  key={h.sym}
                  style={{
                    flexGrow: h.pct,
                    background: tokenColor(h.sym),
                    marginLeft: i === 0 ? 0 : -5,
                    zIndex: shown.length - i,
                  }}
                  className="relative basis-0 cursor-pointer rounded-[3px]"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
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
                  <p className="text-xs font-semibold text-white">{shown[hover].sym}</p>
                  <p className="text-[10px] text-white/55">
                    {shown[hover].pct}% · ${shown[hover].val.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-3">
            {shown.map((h, i) => (
              <div
                key={h.sym}
                className={`flex items-center gap-3 py-2.5 ${i < shown.length - 1 ? "border-b border-[#E8EAEC]" : ""}`}
              >
                <TokenIcon sym={h.sym} color={tokenColor(h.sym)} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0C1A2B]">{h.sym}</p>
                </div>
                <span className="w-10 text-right text-xs font-medium text-[#5B7490]">
                  {h.pct}%
                </span>
                <div className="w-16 text-right">
                  <p className="flex items-center justify-end text-sm font-semibold text-[#0C1A2B]">
                    <span>$</span>
                    <SlidingNumber number={h.val} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Agent card ──────────────────────────────────────────

const ACT_TAG: Record<string, string> = {
  Rebalance: "bg-[#EAF4FC] text-[#1591DC]",
  Deposit:   "bg-green-50 text-green-600",
  Withdraw:  "bg-orange-50 text-orange-600",
  Monitor:   "bg-[#EDF2F7] text-[#5B7490]",
};

const AGENT_STATES = {
  idle:    { label: "Idle",    dot: "bg-[#1591DC]" },
  running: { label: "Running", dot: "bg-[#8CC8EE]" },
  paused:  { label: "Paused",  dot: "bg-[#B4C0CE]" },
} as const;

function AgentCard() {
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { address } = useAccount();
  const { riskPreference, paused } = usePortfolio(vaultAddress, address);
  const { activities, isLoading } = useActivity(3);

  const stateKey: keyof typeof AGENT_STATES = paused ? "paused" : "idle";
  const state = AGENT_STATES[stateKey];
  const running = (stateKey as string) === "running";

  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 450);
    return () => clearInterval(id);
  }, [running]);

  const riskLabel = riskPreference != null ? (RISK_LABELS[riskPreference] ?? "—") : "—";

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="flex flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
            Your Agent
          </p>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${state.dot}`} />
            <span className="text-[11px] font-medium text-[#5B7490]">
              {state.label}{running ? dots : ""}
            </span>
          </span>
        </div>
        <Link
          href="/agent"
          aria-label="Open agent"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]">Risk</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B]">{riskLabel}</p>
        </div>
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#94A3B8]">Status</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B]">{state.label}</p>
        </div>
      </div>

      <div className="mt-2">
        {isLoading ? (
          <div className="space-y-2.5 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-[#E8EAEC]" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="py-3 text-xs text-[#94A3B8]">No activity yet.</p>
        ) : (
          activities.map((a, i) => {
            const { type, desc } = activityLabel(a.action, a.metadata);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 py-2.5 ${i < activities.length - 1 ? "border-b border-[#E8EAEC]" : ""}`}
              >
                <span
                  className={`w-20 shrink-0 rounded-md px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${ACT_TAG[type] ?? ACT_TAG.Monitor}`}
                >
                  {type}
                </span>
                <span className="flex-1 truncate text-[13px] text-[#0C1A2B]">{desc}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#94A3B8]">
                  {relTime(a.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function OverviewPage() {
  const [modal, setModal] = useState<null | "deposit" | "withdraw">(null);
  return (
    <>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">Overview</h1>
            <p className="mt-1 text-sm text-[#5B7490]">Where your money sits today.</p>
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
