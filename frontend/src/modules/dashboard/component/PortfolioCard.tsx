"use client";

import { useState, useRef, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import SlidingNumber from "@/components/elements/SlidingNumber";

const BENTO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export interface PortfolioCardProps {
  totalAssetsUSDC: number;
  delta?: number;
  isLoading: boolean;
}

const CHART_H = 150;
const PAD = 8;
const N_POINTS = 30;

// Catmull-Rom → bezier smooth path
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

// mulberry32 deterministic PRNG
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateData(totalAssetsUSDC: number): number[] {
  if (totalAssetsUSDC <= 0) {
    return Array.from({ length: N_POINTS }, (_, i) => 1000 + i * 10);
  }
  const rand = mulberry32(Math.round(totalAssetsUSDC));
  const start = totalAssetsUSDC * 0.92;
  const arr: number[] = [];
  let v = start;
  for (let i = 0; i < N_POINTS - 1; i++) {
    v += (rand() - 0.45) * totalAssetsUSDC * 0.008;
    arr.push(Math.max(start * 0.9, v));
  }
  arr.push(totalAssetsUSDC);
  return arr;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dateForIndex(i: number): string {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - (N_POINTS - 1 - i));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const REBALANCES = [6, 14, 22, 28];

function PortfolioChart({ data }: { data: number[] }) {
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

  const min = Math.min(...data);
  const max = Math.max(...data);
  const rng = max - min || 1;
  const nn = data.length;
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
    let lo = 0; let hi = len;
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
    const value = Math.round(data[i0] + (data[i1] - data[i0]) * (pos - i0));
    hv = { x: hoverX, y: yAtX(hoverX), value, date: dateForIndex(Math.round(pos)) };
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <svg
        width={w} height={CHART_H}
        className="block"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverX(Math.max(pts[0].x, Math.min(pts[nn - 1].x, e.clientX - rect.left)));
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1591DC" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1591DC" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={area} fill="url(#pf-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.45 }} />
        <motion.path
          ref={lineRef}
          d={line} fill="none" stroke="#1591DC" strokeWidth="2"
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
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-tip px-3 py-2 text-left shadow-lg"
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
    </div>
  );
}

export function PortfolioCard({ totalAssetsUSDC, delta, isLoading }: PortfolioCardProps) {
  const [range, setRange] = useState("30D");
  const data = generateData(totalAssetsUSDC);

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-edge bg-card p-5 lg:col-span-2"
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
          Your Portfolio
        </p>
        <div className="flex gap-0.5 rounded-lg bg-panel p-0.5">
          {["7D", "30D", "90D", "1Y"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                range === r
                  ? "bg-brand-soft text-brand"
                  : "text-dim hover:text-ink dark:text-white/45 dark:hover:text-white"
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
            {isLoading ? (
              <div className="mt-1 h-8 w-32 tends-skeleton rounded-lg" />
            ) : (
              <p className="mt-1 flex items-center text-[2rem] font-semibold leading-none tracking-[-0.04em] text-ink">
                <span>$</span>
                <SlidingNumber number={totalAssetsUSDC} decimalPlaces={2} />
              </p>
            )}
            {delta !== undefined && delta !== 0 && (
              <p className={`mt-2 flex items-center gap-1 text-sm font-medium ${delta >= 0 ? "text-pos" : "text-neg"}`}>
                <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
              </p>
            )}
          </div>
          <div className="my-5 h-px bg-edge" />
          <p className="text-xs text-dim">Simulated range</p>
          <p className="flex items-center text-sm text-faint">{range} view</p>
        </div>
        <div className="pl-6">
          {isLoading ? (
            <div className="h-[150px] tends-skeleton rounded-xl" />
          ) : (
            <PortfolioChart key={Math.round(totalAssetsUSDC)} data={data} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
