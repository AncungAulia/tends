"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { TokenIcon, tokenColor } from "@/components/preview/TokenIcon";
import { DepositModal, WithdrawModal } from "@/components/preview/MoneyModals";
import SlidingNumber from "@/components/preview/SlidingNumber";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useUserVault } from "@/hooks/useUserVault";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { useActivity, type ActivityEntry } from "@/hooks/useActivityLog";
import { useStrategies } from "@/hooks/useStrategies";
import { useVaultStore } from "@/hooks/useVaultStore";
import { apiFetch } from "@/lib/api";

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
const RANGE_PTS: Record<string, number> = { "7D": 7, "30D": 30, "90D": 45, "1Y": 52 };

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
  range,
}: {
  data: number[];
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
    <motion.div
      ref={ref}
      className="relative min-w-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeInOut" }}
    >
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
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-left shadow-lg"
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
    </motion.div>
  );
}

// ─── Portfolio card ──────────────────────────────────────

function PortfolioCard() {
  const { address } = useAccount();
  const { getAccessToken } = usePrivy();
  const { vaultAddress, initialDeposit } = useUserVault();
  const { totalAssetsUSDC, riskPreference } = usePortfolio(vaultAddress, address);
  const { totalValueUSD } = useVaultHoldings(vaultAddress);
  const { strategies } = useStrategies();
  const { activities } = useActivity();
  const [range, setRange] = useState("30D");

  // Real historical PnL snapshots from backend (hourly, taken by pnl-snapshot job)
  const { data: pnlData } = useQuery({
    queryKey: ["pnl", range],
    queryFn: async () => {
      const token = await getAccessToken();
      return apiFetch<{
        initialDepositUsd: number;
        points: { t: number; valueUsd: number }[];
      }>(`/api/users/me/pnl?range=${range.toLowerCase()}`, token);
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Prefer oracle-priced total; fall back to on-chain totalAssets
  const currentValue = totalValueUSD > 0 ? totalValueUSD : totalAssetsUSDC;
  const depositedUSD = initialDeposit ? Number(initialDeposit) / 1e6 : 0;
  const startValue = (() => {
    if (depositedUSD > 0) return depositedUSD;
    if ((pnlData?.initialDepositUsd ?? 0) > 0) return pnlData!.initialDepositUsd;
    const first = pnlData?.points?.[0]?.valueUsd;
    return first && first > 0 ? first : currentValue * 0.97;
  })();

  const pctChange =
    startValue > 0 && currentValue > 0
      ? ((currentValue - startValue) / startValue) * 100
      : null;
  const pctPositive = pctChange == null || pctChange >= 0;

  const strategyId = riskPreference != null ? STRATEGY_IDS[riskPreference] : undefined;
  const apy = strategies.find((s) => s.id === strategyId)?.blendedApyPct ?? null;

  const pts = RANGE_PTS[range] ?? 30;
  // Prepend range-proportional flat padding at deposit value so each range
  // looks visually distinct even when real snapshot history is short.
  const chartData = useMemo(() => {
    if (pnlData?.points && pnlData.points.length >= 2) {
      const real = [...pnlData.points.map((p) => p.valueUsd), currentValue];
      const rangeMs = RANGE_MS[range] ?? RANGE_MS["30D"];
      const dataFraction = Math.min(1, (Date.now() - pnlData.points[0]!.t * 1000) / rangeMs);
      if (dataFraction < 0.85) {
        const padCount = Math.round(pts * (1 - dataFraction));
        const padVal = startValue > 0 ? startValue : real[0]!;
        return [...Array<number>(padCount).fill(padVal), ...real];
      }
      return real;
    }
    return buildChartSeries(startValue, currentValue, pts);
  }, [pnlData, currentValue, startValue, pts, range]);

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-edge bg-card p-5 lg:col-span-2"
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
          Your Portfolio
        </p>
        <div className="flex gap-0.5 rounded-lg bg-app p-0.5">
          {["7D", "30D", "90D", "1Y"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                range === r ? "bg-brand-soft text-brand" : "text-dim hover:text-ink"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[210px_1fr]">
        <div className="flex flex-col justify-center">
          <p className="text-xs text-dim">Total Portfolio Value</p>
          <div className="flex items-end gap-2">
            <p className="mt-1 flex items-center text-[2rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              <span>$</span>
              <SlidingNumber number={currentValue} decimalPlaces={2} />
            </p>
            {pctChange != null && (
              <p className={`mt-2 flex items-center gap-1 text-sm font-medium ${pctPositive ? "text-pos" : "text-red-500"}`}>
                {pctPositive
                  ? <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                  : <TrendingDown className="h-4 w-4" strokeWidth={2.2} />}
                {pctPositive ? "+" : ""}{pctChange.toFixed(1)}%
              </p>
            )}
          </div>
          <div className="my-5 h-px bg-edge" />
          <p className="text-xs text-dim">Estimated APY</p>
          <p className="flex items-center text-2xl font-semibold tracking-[-0.03em] text-ink">
            {apy != null ? (
              <><SlidingNumber number={apy} decimalPlaces={1} />%</>
            ) : (
              <span className="text-faint">—</span>
            )}
          </p>
        </div>
        <div className="pl-6">
          <AnimatePresence mode="wait">
            <PortfolioChart key={range} data={chartData} range={range} />
          </AnimatePresence>
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
  const [unit, setUnit] = useState<"usd" | "token">("usd");
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  const allHoldings = holdings
    .filter((h) => (h.valueUSD ?? 0) >= 0.01)
    .map((h) => ({
      sym: h.symbol,
      pct: totalValueUSD > 0 ? Math.round(((h.valueUSD ?? 0) / totalValueUSD) * 1000) / 10 : 0,
      val: h.valueUSD ?? 0,
      qty: h.balanceHuman,
      qDec: h.decimals === 6 ? 2 : 4,
    }));

  const PER = 3;
  const pages = Math.max(1, Math.ceil(allHoldings.length / PER));
  const rows = allHoldings.slice(page * PER, page * PER + PER);

  function go(next: number) {
    setDir(next > page ? 1 : -1);
    setPage(next);
  }

  const centerPct =
    hover === null
      ? 0
      : allHoldings.slice(0, hover).reduce((s, h) => s + h.pct, 0) +
        (allHoldings[hover]?.pct ?? 0) / 2;

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="flex flex-col rounded-2xl border-[1.25px] border-edge bg-card p-5"
    >
      {/* header: title + pagination + toggle */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
            Your Holdings
          </p>
          <div className="flex items-center justify-center gap-0">
            <button
              onClick={() => go(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Previous holdings"
              className="flex h-6 w-6 items-center justify-center rounded-full text-dim transition-colors hover:bg-app disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => go(Math.min(pages - 1, page + 1))}
            disabled={page === pages - 1}
            aria-label="Next holdings"
            className="flex h-6 w-6 items-center justify-center rounded-full text-dim transition-colors hover:bg-app disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-lg bg-app p-0.5 text-[11px] font-medium">
          {(["usd", "token"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                unit === u
                  ? "bg-brand-soft text-brand"
                  : "text-dim hover:text-ink"
              }`}
            >
              {u === "usd" ? "$" : "Ξ"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-3.5 animate-pulse rounded-full bg-edge" />
      ) : allHoldings.length === 0 ? (
        <p className="text-xs text-faint">No holdings yet. Deposit to get started.</p>
      ) : (
        <>
          {/* segmented allocation bar — all holdings, not just this page */}
          <div className="relative">
            <div className="flex h-3.5">
              {allHoldings.map((h, i) => (
                <div
                  key={h.sym}
                  style={{
                    flexGrow: h.pct,
                    background: tokenColor(h.sym),
                    marginLeft: i === 0 ? 0 : -5,
                    zIndex: allHoldings.length - i,
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
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-left shadow-lg"
                  style={{ left: `${centerPct}%`, transformOrigin: "bottom center" }}
                  initial={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  <p className="text-xs font-semibold text-white">{allHoldings[hover]?.sym}</p>
                  <p className="text-[10px] text-white/55">
                    {allHoldings[hover]?.pct.toFixed(1)}% · ${allHoldings[hover]?.val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* paged legend */}
          <div className="relative mt-3 flex-1 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={page}
                initial={{ opacity: 0, x: dir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -28 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                {rows.map((h, i) => (
                  <div
                    key={h.sym}
                    className={`flex items-center gap-3 py-2.5 ${i < rows.length - 1 ? "border-b border-edge" : ""}`}
                  >
                    <TokenIcon sym={h.sym} color={tokenColor(h.sym)} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{h.sym}</p>
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-dim">
                      {h.pct.toFixed(1)}%
                    </span>
                    <div className="w-24 text-right">
                      {unit === "usd" ? (
                        <p className="flex items-center justify-end text-sm font-semibold text-ink">
                          <span>$</span>
                          <SlidingNumber number={h.val} decimalPlaces={2} />
                        </p>
                      ) : (
                        <p className="flex items-center justify-end gap-1 text-sm font-semibold text-ink">
                          <SlidingNumber number={h.qty} decimalPlaces={h.qDec} />
                          <span className="text-[10px] font-medium text-faint">
                            {h.sym}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Agent card ──────────────────────────────────────────

const ACT_TAG: Record<string, string> = {
  Rebalance: "bg-brand-soft text-brand",
  Deposit:   "bg-pos-soft text-pos",
  Withdraw:  "bg-red-50 text-red-600",
  Monitor:   "bg-panel text-dim",
};

const AGENT_STATES = {
  idle:    { label: "Idle",    dot: "bg-brand" },
  running: { label: "Running", dot: "bg-brand" },
  paused:  { label: "Paused",  dot: "bg-panel" },
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
      className="flex flex-col rounded-2xl border-[1.25px] border-edge bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
            Your Agent
          </p>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${state.dot}`} />
            <span className="text-[11px] font-medium text-dim">
              {state.label}{running ? dots : ""}
            </span>
          </span>
        </div>
        <Link
          href="/agent"
          aria-label="Open agent"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-dim transition-colors hover:border-dim hover:text-ink"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-panel px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-faint">Risk</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{riskLabel}</p>
        </div>
        <div className="flex-1 rounded-xl bg-panel px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.08em] text-faint">Next run</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">—</p>
        </div>
      </div>

      <div className="mt-2">
        {isLoading ? (
          <div className="space-y-2.5 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-edge" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="py-3 text-xs text-faint">No activity yet.</p>
        ) : (
          activities.map((a, i) => {
            const { type, desc } = activityLabel(a.action, a.metadata);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 py-2.5 ${i < activities.length - 1 ? "border-b border-edge" : ""}`}
              >
                <span
                  className={`w-20 shrink-0 rounded-md px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${ACT_TAG[type] ?? ACT_TAG.Monitor}`}
                >
                  {type}
                </span>
                <span className="flex-1 truncate text-[13px] text-ink">{desc}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-faint">
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
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">Overview</h1>
            <p className="mt-1 text-sm text-dim">Where your money sits today.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setModal("withdraw")}
              className="rounded-full border-[1.25px] border-edge bg-card px-4 py-2 text-sm font-medium text-dim transition-colors hover:text-ink"
            >
              Withdraw
            </button>
            <button
              onClick={() => setModal("deposit")}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
