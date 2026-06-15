"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  TokenIcon,
  tokenColor,
  ALL_TOKENS,
} from "@/components/preview/TokenIcon";
import ExclusionField from "@/components/preview/ExclusionField";
import SlidingNumber from "@/components/preview/SlidingNumber";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useUserVault } from "@/hooks/useUserVault";
import { useAgentConfig, type AgentConfig } from "@/hooks/useAgentConfig";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import { useStrategies } from "@/hooks/useStrategies";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";

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
    riskCls: "bg-pos-soft text-pos border-green-200",
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
    riskCls: "bg-warn-soft text-warn border-yellow-200",
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
    riskCls: "bg-neg-soft text-neg border-red-200",
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
    riskCls: "bg-brand-soft text-brand border-brand/20",
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

// ─── Backend wiring helpers ─────────────────────────────────

// Backend's strategy allocation strings use "MNT"; the FE token catalog uses
// "WMNT" (the wrapped token actually held). Reconcile here until backend aligns.
const SYMBOL_FIX: Record<string, string> = { MNT: "WMNT" };

/** "40% cmETH + 30% sUSDe" (from /api/strategies) → [{ sym:"cmETH", pct:40 }, ...] */
function parseBackendAllocation(raw: string): Alloc[] {
  return raw
    .split("+")
    .map((part) => {
      const m = part.trim().match(/^(\d+)%\s+(.+)$/);
      if (!m) return null;
      const sym = m[2].trim();
      return { sym: SYMBOL_FIX[sym] ?? sym, pct: Number(m[1]) };
    })
    .filter(Boolean) as Alloc[];
}

// Shape returned by POST /api/projection (server-computed, real APY-driven).
interface ProjectionResult {
  capital: number;
  durationDays: number;
  blendedApyPct: number;
  base: number;
  best: number;
  worst: number;
}

// FE id ("Low") → backend StrategyId ("LOW").
const toStrategyId = (id: string) => id.toUpperCase() as "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";

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
  base,
  best,
  worst,
  vol,
  years,
  mode,
  seed,
}: {
  capital: number;
  // End-of-horizon values come from the backend projection (real, APY-driven).
  // The in-between wiggle is illustrative volatility only — see disclaimer below.
  base: number;
  best: number;
  worst: number;
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

  const targetFor = (k: string) =>
    k === "best" ? best : k === "worst" ? worst : base;

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
          width="100%"
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
            className="stroke-faint"
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
                className="stroke-dim"
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
              className="pointer-events-none absolute whitespace-nowrap rounded-lg bg-tip px-2.5 py-1.5 text-left shadow-lg"
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
              <p className="text-[0.625rem] text-white/55">{hv.when}</p>
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
      <div className="mt-2 flex items-center gap-1.5 text-[0.625rem] text-faint">
        <span>
          {impliedPct !== null
            ? `Projected approximately at ${impliedPct}%/year`
            : "Projected range, based on current yields"}
        </span>
        {/* fine-print disclaimer, tucked behind an info icon */}
        <span className="group relative inline-flex">
          <button
            aria-label="About this projection"
            className="flex h-3 w-3 items-center justify-center rounded-full border border-edge2 text-[0.5rem] font-semibold leading-none text-faint transition-colors hover:border-dim hover:text-dim"
          >
            i
          </button>
          <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-56 -translate-x-1/2 rounded-lg bg-tip px-2.5 py-1.5 text-[0.625rem] leading-snug text-white/80 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
        className="flex items-center gap-1.5 rounded-full border-[1.25px] border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-dim"
      >
        {value.label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-dim transition-transform ${open ? "rotate-180" : ""}`}
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
            className="absolute right-0 top-[calc(100%+6px)] z-20 w-36 rounded-xl border-[1.25px] border-edge bg-card p-1 shadow-lg shadow-[#0C1A2B]/8"
          >
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                  d.label === value.label
                    ? "font-semibold text-brand"
                    : "text-dim"
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

// ─── Guardrails (advanced) ──────────────────────────────────

type Guardrails = {
  checkEvery: string;
  maxPerAsset: number;
  dailyLimit: number;
  minDrift: number;
  stopLoss: number;
  notes: string;
};

const DEFAULT_GUARDRAILS: Guardrails = {
  checkEvery: "4h",
  maxPerAsset: 50,
  dailyLimit: 3,
  minDrift: 5,
  stopLoss: 0,
  notes:
    "Prefer stable yield on weekends. Don't touch my cmETH position unless volatility spikes above 20%. Lean conservative near month-end.",
};

const FREQ_PRESETS = [
  { value: "1h", label: "Every 1 hour" },
  { value: "2h", label: "Every 2 hours" },
  { value: "4h", label: "Every 4 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours" },
];

function GuardrailRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumInput({
  value,
  suffix,
  onChange,
}: {
  value: string | number;
  suffix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5">
      <input
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="w-10 bg-transparent text-right text-sm font-semibold text-ink outline-none"
      />
      {suffix && <span className="text-xs text-dim">{suffix}</span>}
    </div>
  );
}

function FreqDropdown({
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
  const current = FREQ_PRESETS.find((f) => f.value === value);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-dim"
      >
        {current?.label ?? value}
        <ChevronDown
          className={`h-3.5 w-3.5 text-dim transition-transform ${open ? "rotate-180" : ""}`}
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
            className="absolute right-0 top-[calc(100%+6px)] z-20 w-44 rounded-xl border-[1.25px] border-edge bg-card p-1 shadow-lg shadow-[#0C1A2B]/8"
          >
            {FREQ_PRESETS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  onChange(f.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                  f.value === value ? "font-semibold text-brand" : "text-dim"
                }`}
              >
                {f.label}
                {f.value === value && <Check className="h-3 w-3" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function SetupPreview() {
  const [selectedId, setSelectedId] = useState(CURRENT);
  const [capital, setCapital] = useState(0);
  const [capitalEdited, setCapitalEdited] = useState(false);
  const [duration, setDuration] = useState(DURATIONS[2]);
  const [allocHover, setAllocHover] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState("all");
  const [customW, setCustomW] = useState({ Low: 40, Medium: 40, High: 20 });
  const [avoid, setAvoid] = useState<string[]>([]);
  const [gr, setGr] = useState<Guardrails>(DEFAULT_GUARDRAILS);
  const [advOpen, setAdvOpen] = useState(false);
  const num = (v: string) =>
    Math.max(0, parseInt(v.replace(/[^0-9]/g, ""), 10) || 0);

  // ── Wiring: guardrails ↔ backend agent-config (off-chain) ──────────────
  const { vaultAddress } = useUserVault();
  const { config: agentConfig, save: saveAgentConfig } = useAgentConfig();

  // seed the guardrail form from the backend once config loads
  useEffect(() => {
    if (!agentConfig) return;
    setGr({
      checkEvery: agentConfig.cadenceSec
        ? `${Math.round(agentConfig.cadenceSec / 3600)}h`
        : "4h",
      maxPerAsset: agentConfig.maxPerAssetPct ?? 50,
      dailyLimit: agentConfig.dailyLimitPerDay ?? 3,
      minDrift:
        agentConfig.driftThresholdBps != null
          ? Math.round(agentConfig.driftThresholdBps / 100)
          : 5,
      stopLoss: agentConfig.stopLossPct ?? 0,
      notes: agentConfig.notes ?? "",
    });
  }, [agentConfig]);

  // update a guardrail locally + debounced-persist the mapped patch to backend
  const grSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grPending = useRef<Partial<AgentConfig>>({});
  const patchGr = (partial: Partial<Guardrails>) => {
    setGr((c) => ({ ...c, ...partial }));
    const api: Partial<AgentConfig> = {};
    if (partial.checkEvery !== undefined)
      api.cadenceSec = (parseInt(partial.checkEvery, 10) || 4) * 3600;
    if (partial.maxPerAsset !== undefined)
      api.maxPerAssetPct = partial.maxPerAsset;
    if (partial.dailyLimit !== undefined)
      api.dailyLimitPerDay = partial.dailyLimit;
    if (partial.minDrift !== undefined)
      api.driftThresholdBps = partial.minDrift * 100;
    if (partial.stopLoss !== undefined) {
      api.stopLossPct = partial.stopLoss;
      api.stopLossEnabled = partial.stopLoss > 0;
    }
    if (partial.notes !== undefined) api.notes = partial.notes;
    Object.assign(grPending.current, api);
    if (grSaveTimer.current) clearTimeout(grSaveTimer.current);
    grSaveTimer.current = setTimeout(() => {
      const p = grPending.current;
      grPending.current = {};
      if (vaultAddress) saveAgentConfig(p).catch(() => {});
    }, 600);
  };

  // ── Wiring: current tier + on-chain switch ─────────────────────────────
  const TIER_LABELS = ["Low", "Medium", "High", "Custom"];
  const { currentLevel, setStrategy, setCustomStrategy, isPending: switching } =
    useRiskLevel(vaultAddress);
  const currentTier =
    currentLevel != null ? (TIER_LABELS[currentLevel] ?? null) : null;
  // default the previewed tier to the user's actual current tier once it loads
  useEffect(() => {
    if (currentLevel != null)
      setSelectedId(TIER_LABELS[currentLevel] ?? "Medium");
  }, [currentLevel]);
  const onSwitch = () => {
    if (!vaultAddress) return;
    const sel = STRATEGIES.find((s) => s.id === selectedId);
    if (sel?.apy === null) {
      setCustomStrategy?.(
        customW.Low * 100,
        customW.Medium * 100,
        customW.High * 100,
      );
    } else {
      setStrategy?.(selectedId.toUpperCase() as "LOW" | "MEDIUM" | "HIGH");
    }
  };

  // ── Wiring: wallet balance + live strategy APY/allocation ──────────────
  const { address } = useAccount();
  const { balance } = useUSDCBalance(address);
  const { strategies: backendStrategies } = useStrategies();

  // Default the capital field to the user's actual USDC balance (once, until
  // they type). "From your balance" should reflect real funds, not a mock number.
  useEffect(() => {
    const b = Math.floor(Number(balance));
    if (!capitalEdited && b > 0) setCapital(b);
  }, [balance, capitalEdited]);

  const strat = STRATEGIES.find((s) => s.id === selectedId)!;
  const isCurrent = selectedId === currentTier;
  const isCustom = strat.apy === null;

  // Backend overlay: real blended APY + allocation per preset. Falls back to the
  // local copy while /api/strategies loads (or for metadata the API doesn't carry).
  const backendCur = backendStrategies.find((s) => s.id === toStrategyId(selectedId));
  const backendApy = backendCur?.blendedApyPct ?? null;
  const backendAlloc =
    backendCur && !isCustom ? parseBackendAllocation(backendCur.allocation) : null;

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

  // ── Wiring: server-computed projection (real, APY-driven) ──────────────
  const durationDays = Math.round(duration.years * 365);
  const projValid = capital > 0 && (!isCustom || customValid);
  const lowBps = customW.Low * 100;
  const medBps = customW.Medium * 100;
  const { data: projData } = useQuery({
    queryKey: [
      "setup-projection",
      toStrategyId(selectedId),
      capital,
      durationDays,
      isCustom ? `${customW.Low}-${customW.Medium}-${customW.High}` : "",
    ],
    enabled: projValid,
    queryFn: () =>
      apiFetch<ProjectionResult>("/api/projection", null, {
        method: "POST",
        body: JSON.stringify({
          strategyId: toStrategyId(selectedId),
          capital,
          durationDays,
          ...(isCustom
            ? { customAllocation: { lowBps, medBps, highBps: 10_000 - lowBps - medBps } }
            : {}),
        }),
      }),
  });

  // APY: prefer the backend's blended figure; CUSTOM reads it off the projection
  // (the only place the backend computes a custom blend). Local copy is fallback.
  const apy = isCustom
    ? (projData?.blendedApyPct ?? blended.apy)
    : (backendApy ?? strat.apy ?? 0);
  const vol = isCustom ? blended.vol : strat.vol;
  const baseAlloc = isCustom ? blended.alloc : (backendAlloc ?? strat.alloc);
  // exclusions are a composition constraint: drop avoided tokens, renormalize the rest
  const alloc = (() => {
    const kept = baseAlloc.filter((a) => !avoid.includes(a.sym));
    const sum = kept.reduce((s, a) => s + a.pct, 0) || 1;
    return kept.map((a) => ({ ...a, pct: Math.round((a.pct / sum) * 100) }));
  })();
  // End values from the backend projection; local project() only bridges the gap
  // while the request is in flight so the UI never flashes empty.
  const localProj = project(capital, apy, vol, duration.years);
  const base = projData?.base ?? localProj.base;
  const best = projData?.best ?? localProj.best;
  const worst = projData?.worst ?? localProj.worst;

  // hovered allocation segment → tooltip ($ derived from capital)
  const ah =
    allocHover !== null && allocHover < alloc.length ? alloc[allocHover] : null;
  const allocCenter = ah
    ? alloc.slice(0, allocHover!).reduce((s, a) => s + a.pct, 0) + ah.pct / 2
    : 0;

  // primary action: switch to this strategy. When it's already the active plan
  // (or custom weights are incomplete) the button stays visible but disabled, so
  // the layout never shifts and the state reads clearly.
  const primaryDisabled = (isCustom ? !customValid : isCurrent) || switching;
  const primaryLabel = switching
    ? "Switching..."
    : isCustom
      ? "Set custom mix"
      : isCurrent
        ? "Current strategy"
        : `Switch to ${strat.id}`;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-2 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="hidden md:block">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Setup</h1>
          <p className="mt-1 text-sm text-dim">
            Choose your strategy and set how the agent runs.
          </p>
        </div>
        {/* desktop: actions stay top-right (mobile shows them under the card) */}
        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          <button
            onClick={onSwitch}
            disabled={primaryDisabled}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ─── LEFT: strategy + apply ─── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-1 flex-col rounded-2xl border-[1.25px] border-edge bg-card p-5">
          {/* role header */}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
            Strategy
          </p>
          <p className="mb-4 mt-0.5 text-xs text-dim">
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
                  className={`relative flex-1 border-[1.25px] border-edge px-2 py-2 text-xs font-medium transition-colors ${
                    i === 0 ? "rounded-l-lg" : "ml-[-1.25px]"
                  } ${i === STRATEGIES.length - 1 ? "rounded-r-lg" : ""} ${
                    active
                      ? "z-10 border-brand bg-brand-soft font-semibold text-brand"
                      : "bg-card text-dim hover:bg-panel"
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
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {isCustom ? "Custom" : `${strat.id} Risk`}
              </h2>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-[-0.03em] text-ink">
                  {`${apy.toFixed(1)}%`}
                </span>
                <span className="text-[0.625rem] tracking-wider text-faint">
                  estimated APY
                </span>
              </p>
            </div>
            {isCurrent && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-dim">
                <span className="h-1.5 w-1.5 rounded-full bg-pos-soft0" />
                Current
              </span>
            )}
          </div>

          {isCustom ? (
            /* custom: user sets the mix across risk levels */
            <div className="mt-4 flex flex-1 flex-col">
              <p className="mb-1 text-xs text-dim">
                How much in each risk?
              </p>
              <div className="flex flex-1 flex-col justify-center">
                {(["Low", "Medium", "High"] as const).map((lvl) => (
                  <div
                    key={lvl}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink">
                        {lvl} Risk
                      </span>
                      {/* <span className="text-[0.625rem] text-faint">
                            {LVL_HINT[lvl]}
                          </span> */}
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border-[1.25px] border-edge bg-card px-2.5 py-1.5 transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-[#1591DC]/15">
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
                        className="w-8 bg-transparent text-right text-sm font-semibold text-ink outline-none"
                      />
                      <span className="text-xs text-dim">%</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* receipt-style total: divider line + sum */}
              <div className="mt-3 border-t-[1.25px] border-edge pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">
                    Total
                  </span>
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <span
                      className={
                        customValid ? "text-ink" : "text-neg"
                      }
                    >
                      {customTotal}%
                    </span>
                    {customValid && (
                      <Check
                        className="h-3.5 w-3.5 text-pos"
                        strokeWidth={2.5}
                      />
                    )}
                  </span>
                </div>
                {!customValid && (
                  <p className="mt-1 text-right text-[0.625rem] text-neg">
                    Must equal 100%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* description */}
              <p className="mt-4 text-sm leading-relaxed text-dim">
                {strat.desc}
              </p>

              {/* characteristics — grows to fill so columns match height without a void */}
              <div className="mt-5 flex flex-1 flex-col justify-around overflow-hidden rounded-xl bg-panel py-1">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-dim">Time to keep</span>
                  <span className="text-xs font-semibold text-ink">
                    {strat.hold}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-dim">
                    Possible worst drop
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    {strat.drop}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-dim">
                    Best suited for
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    {strat.bestFor}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Avoid — composition constraint, lives with the strategy */}
          <div className="mt-5 border-t border-edge pt-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
              Avoid
            </p>
            <p className="mb-3 mt-0.5 text-xs text-dim">
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

          {/* apply — mobile only; desktop keeps it in the header */}
          <div className="md:hidden">
            <button
              onClick={onSwitch}
              disabled={primaryDisabled}
              className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {primaryLabel}
            </button>
          </div>
        </div>

        {/* ─── RIGHT: projection ─── */}
        <div className="flex flex-col rounded-2xl border-[1.25px] border-edge bg-card p-5">
          {/* role header */}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
            Projection
          </p>
          <p className="mb-4 mt-0.5 text-xs text-dim">
            {isCustom
              ? "See what your mix could do with your money."
              : `See what ${strat.id} could do with your money.`}
          </p>

          {/* inputs */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <label className="text-[0.625rem] uppercase tracking-wider text-faint">
                Capital
              </label>
              <div className="mt-1 flex items-center gap-1 rounded-lg border-[1.25px] border-edge bg-card px-3 py-1.5 transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-[#1591DC]/15">
                <span className="text-sm text-dim">$</span>
                <input
                  value={capital ? capital.toLocaleString("en-US") : ""}
                  onChange={(e) => {
                    setCapitalEdited(true);
                    setCapital(Number(e.target.value.replace(/\D/g, "")) || 0);
                  }}
                  inputMode="numeric"
                  className="w-24 bg-transparent text-sm font-semibold text-ink outline-none"
                />
              </div>
              <p className="mt-1 text-[0.625rem] text-faint">
                From your balance
              </p>
            </div>
            <div>
              <label className="text-[0.625rem] uppercase tracking-wider text-faint">
                Duration
              </label>
              <div className="mt-1">
                <DurationDropdown value={duration} onChange={setDuration} />
              </div>
            </div>
          </div>

          {isCustom && !customValid ? (
            <div className="mt-6 rounded-xl bg-panel py-12 text-center">
              <p className="text-sm font-medium text-ink">
                Weights must total 100%
              </p>
              <p className="mt-1 text-xs text-dim">
                You&apos;re at {customTotal}%. Adjust the mix on the left.
              </p>
            </div>
          ) : (
            <>
              {/* allocation — what it buys */}
              <div className="mt-6">
                <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
                  Allocation
                </p>
                <div className="relative">
                  <div className="flex h-6 md:h-3.5">
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
                        className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-tip px-2.5 py-1.5 text-left shadow-lg"
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
                        <p className="text-[0.625rem] text-white/55">
                          {ah.pct}% · {fmtUSD((capital * ah.pct) / 100)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* mobile: one card per allocation */}
                <div className="mt-4 flex flex-col gap-2 md:hidden">
                  {alloc.map((a) => (
                    <div
                      key={a.sym}
                      className="flex items-center gap-2.5 rounded-xl border border-edge bg-panel px-3 py-2.5"
                    >
                      <TokenIcon
                        sym={a.sym}
                        color={tokenColor(a.sym)}
                        size={26}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight text-ink">
                          {a.sym}
                        </p>
                        <p className="text-[0.625rem] text-faint">
                          {fmtUSD((capital * a.pct) / 100)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {a.pct}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* desktop: original inline legend */}
                <div className="mt-3 hidden flex-wrap gap-x-5 gap-y-2 md:flex">
                  {alloc.map((a) => (
                    <div key={a.sym} className="flex items-center gap-2">
                      <TokenIcon
                        sym={a.sym}
                        color={tokenColor(a.sym)}
                        size={22}
                      />
                      <span className="text-sm font-semibold text-ink">
                        {a.sym}
                      </span>
                      <span className="text-xs text-dim">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* growth — principal vs projected earnings (Likely) */}
              <div className="mt-6">
                <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
                  Growth
                </p>
                <div className="flex items-end justify-between">
                  <span className="text-xs text-dim">
                    {fmtUSD(capital)}
                  </span>
                  <span className="text-xs font-medium text-brand">
                    +{fmtUSD(Math.max(0, base - capital))} earned
                  </span>
                </div>
                <div className="mt-2 flex h-3.5">
                  <div
                    style={{ flexGrow: capital, zIndex: 2 }}
                    className="relative basis-0 rounded-[3px] bg-brand-soft transition-[flex-grow] duration-500 ease-out"
                  />
                  <div
                    style={{
                      flexGrow: Math.max(0, base - capital),
                      marginLeft: -5,
                      zIndex: 1,
                    }}
                    className="relative basis-0 rounded-[3px] bg-brand transition-[flex-grow] duration-500 ease-out"
                  />
                </div>
              </div>

              {/* flexible spacer: absorbs leftover slack so the card has no dead bottom */}
              <div className="mt-6 flex-1" />

              {/* lead line + scenarios */}
              <p className="text-xs text-dim">
                In {duration.label}, your{" "}
                <span className="font-medium text-ink">
                  {fmtUSD(capital)}
                </span>{" "}
                could be worth
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 md:gap-3">
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
                      className="rounded-xl bg-panel p-2.5 md:p-3.5"
                    >
                      <p className="text-[0.625rem] uppercase tracking-wider text-dim">
                        {c.label}
                      </p>
                      <p className="mt-1 flex items-center text-base font-semibold tracking-[-0.03em] text-ink md:text-xl">
                        <span>$</span>
                        <SlidingNumber number={Math.round(c.val)} />
                      </p>
                      <div
                        className={`mt-0.5 flex flex-col text-[0.625rem] font-medium md:flex-row md:items-center md:text-xs ${up ? "text-pos" : "text-neg"}`}
                      >
                        <span className="flex items-center">
                          {up ? "+" : "-"}
                          <span>$</span>
                          <SlidingNumber
                            className="inline-flex"
                            number={Math.round(Math.abs(g))}
                          />
                        </span>
                        <span className="mx-1.5 hidden font-normal text-faint md:inline">
                          |
                        </span>
                        <span>
                          {up ? "+" : "-"}
                          {Math.abs(gp).toFixed(1)}%
                        </span>
                      </div>
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
        <div className="mt-5 rounded-2xl border-[1.25px] border-edge bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
                Projected growth
              </p>
              <p className="mt-1 text-xs text-dim">
                {strat.id} strategy · next{" "}
                <span className="font-medium text-ink">
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
                    className={`rounded-full border-[1.25px] px-3 py-1 text-[0.6875rem] font-medium capitalize transition-colors ${
                      active
                        ? ""
                        : "border-edge text-dim hover:text-ink"
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
            base={base}
            best={best}
            worst={worst}
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

      {/* Advanced — guardrails, tucked away; most people never open it */}
      <div className="mt-5">
        <button
          onClick={() => setAdvOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl border-[1.25px] border-edge bg-card px-5 py-4 text-left transition-colors hover:border-edge2"
        >
          <div>
            <p className="text-sm font-medium text-ink">Advanced</p>
            <p className="text-xs text-dim">
              Fine-tune how the agent runs. Most people never need to.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-faint transition-transform ${advOpen ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {advOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden"
            >
              <div className="space-y-6 pt-4">
                <div className="divide-y divide-edge rounded-2xl border-[1.25px] border-edge bg-card px-5">
                  <GuardrailRow
                    label="Running frequency"
                    hint="How often the agent runs"
                  >
                    <FreqDropdown
                      value={gr.checkEvery}
                      onChange={(v) => patchGr({ checkEvery: v })}
                    />
                  </GuardrailRow>
                  <GuardrailRow
                    label="Max per asset"
                    hint="Cap allocation to any single token"
                  >
                    <NumInput
                      value={gr.maxPerAsset}
                      suffix="%"
                      onChange={(v) => patchGr({ maxPerAsset: num(v) })}
                    />
                  </GuardrailRow>
                  <GuardrailRow
                    label="Daily rebalance limit"
                    hint="Max rebalances per day, caps gas"
                  >
                    <NumInput
                      value={gr.dailyLimit}
                      suffix="/ day"
                      onChange={(v) => patchGr({ dailyLimit: num(v) })}
                    />
                  </GuardrailRow>
                  <GuardrailRow
                    label="Min drift to act"
                    hint="Only rebalance if off target by this much"
                  >
                    <NumInput
                      value={gr.minDrift}
                      suffix="%"
                      onChange={(v) => patchGr({ minDrift: num(v) })}
                    />
                  </GuardrailRow>
                  <GuardrailRow
                    label="Stop-loss"
                    hint="Exit an asset if it drops this much (0 = off)"
                  >
                    <NumInput
                      value={gr.stopLoss}
                      suffix="%"
                      onChange={(v) => patchGr({ stopLoss: num(v) })}
                    />
                  </GuardrailRow>
                </div>

                <div>
                  <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-widest text-dim">
                    Personal preference
                  </p>
                  <textarea
                    rows={4}
                    value={gr.notes}
                    onChange={(e) => patchGr({ notes: e.target.value })}
                    className="w-full resize-none rounded-xl border border-edge bg-card p-4 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-1 focus:ring-[#1591DC]/20"
                  />
                  <p className="mt-1.5 text-xs text-dim">
                    Write instructions in plain language. The agent reads this
                    before deciding any action.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-12" />
    </div>
  );
}
