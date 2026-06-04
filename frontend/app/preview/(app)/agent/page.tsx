"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  X,
  Plus,
  Loader2,
  ChevronDown,
  Check,
  Search,
  ArrowRight,
} from "lucide-react";
import { tokenColor } from "@/components/preview/TokenIcon";
import SlidingNumber from "@/components/preview/SlidingNumber";
import { AgentChat } from "@/components/preview/AgentChat";

/* ──────────────────────────────────────────────────────────
   Agent page mock — Tends
   Command center: Control · Chat · Rules
   ────────────────────────────────────────────────────────── */

// ─── Shared helpers ─────────────────────────────────────────

function Toggle({
  on,
  onClick,
  sm,
}: {
  on: boolean;
  onClick: () => void;
  sm?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 rounded-full transition-colors ${sm ? "h-6 w-11" : "h-7 w-12"} ${on ? "bg-[#1591DC]" : "bg-[#E8EAEC]"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform ${sm ? "h-5 w-5" : "h-6 w-6"} ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
        {children}
      </p>
      {right}
    </div>
  );
}

function GuardrailRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#0C1A2B]">{label}</p>
        {hint && <p className="text-xs text-[#5B7490]">{hint}</p>}
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
  onChange?: (v: string) => void;
}) {
  const cls =
    "w-10 bg-transparent text-right text-sm font-semibold text-[#0C1A2B] outline-none";
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#E8EAEC] bg-white px-3 py-1.5">
      {onChange ? (
        <input
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      ) : (
        <input defaultValue={String(value)} className={cls} />
      )}
      {suffix && <span className="text-xs text-[#5B7490]">{suffix}</span>}
    </div>
  );
}

function fmtCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

// ─── Agent config (single source of truth, read by Control + Guardrails) ──

type RiskKey = "Low" | "Medium" | "High";

type AgentConfig = {
  risk: RiskKey;
  checkEvery: string; // preset key, capped at 24h
  maxPerAsset: number;
  dailyLimit: number;
  minDrift: number;
  stopLoss: { on: boolean; value: number };
  notes: string;
};

const RISK_COPY: Record<RiskKey, { dot: string; desc: string }> = {
  Low: { dot: "bg-green-500", desc: "Protects first, grows slowly" },
  Medium: { dot: "bg-yellow-400", desc: "Balances growth and safety" },
  High: { dot: "bg-orange-500", desc: "Chases yield, rides the swings" },
};

// target basket per risk (mirror of Plan strategies) — shown read-only in the cockpit
const RISK_MIX: Record<RiskKey, { sym: string; pct: number }[]> = {
  Low: [
    { sym: "mUSD", pct: 90 },
    { sym: "USDY", pct: 10 },
  ],
  Medium: [
    { sym: "mUSD", pct: 40 },
    { sym: "mETH", pct: 30 },
    { sym: "cmETH", pct: 30 },
  ],
  High: [
    { sym: "cmETH", pct: 40 },
    { sym: "sUSDe", pct: 30 },
    { sym: "mETH", pct: 20 },
    { sym: "WMNT", pct: 10 },
  ],
};

// check-frequency presets. min 1h (no fat-finger), max 24h (never blind for days).
const FREQ_PRESETS = [
  { value: "1h", label: "Every 1 hour" },
  { value: "2h", label: "Every 2 hours" },
  { value: "4h", label: "Every 4 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours" },
];
const DEFAULT_CONFIG: AgentConfig = {
  risk: "Medium",
  checkEvery: "4h",
  maxPerAsset: 50,
  dailyLimit: 3,
  minDrift: 5,
  stopLoss: { on: true, value: 10 },
  notes:
    "Prefer stable yield on weekends. Don't touch my cmETH position unless volatility spikes above 20%. Lean conservative near month-end.",
};

// ─── Custom dropdown (on-brand, replaces native select) ─────

function Dropdown({
  value,
  options,
  onChange,
  align = "right",
  minW = "min-w-[10rem]",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  align?: "left" | "right";
  minW?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[#E8EAEC] bg-white px-3 py-1.5 text-sm font-medium text-[#0C1A2B] transition-colors hover:border-[#CBD5E1]"
      >
        {current?.label ?? value}
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{
              transformOrigin: align === "right" ? "top right" : "top left",
            }}
            className={`absolute z-30 mt-1.5 ${minW} overflow-hidden rounded-xl border border-[#E8EAEC] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8 ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                  o.value === value
                    ? "bg-[#EAF4FC] font-medium text-[#1591DC]"
                    : "text-[#0C1A2B] hover:bg-[#F7F9FC]"
                }`}
              >
                {o.label}
                {o.value === value && (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Underline tab bar (left-aligned) ───────────────────────

function UnderlineTabs({
  tabs,
  active,
  onChange,
  runningTab,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  runningTab?: string;
}) {
  return (
    <div className="mb-6 mt-5 flex gap-6">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors ${
              on
                ? "border-[#1591DC] text-[#1591DC]"
                : "border-transparent text-[#5B7490] hover:text-[#0C1A2B]"
            }`}
          >
            {t.label}
            {runningTab === t.id && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1591DC] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#1591DC]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Agent dial ─────────────────────────────────────────────

function AgentDial({ state }: { state: "on" | "off" | "running" }) {
  const arcRef = useRef<SVGGElement>(null);
  const angle = useRef(0);
  const speed = useRef(0);

  const target = state === "running" ? 320 : state === "on" ? 42 : 0;
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speed.current +=
        (targetRef.current - speed.current) * Math.min(1, dt * 3.5);
      if (targetRef.current === 0 && Math.abs(speed.current) < 0.4)
        speed.current = 0;
      angle.current = (angle.current + speed.current * dt) % 360;
      if (arcRef.current)
        arcRef.current.setAttribute(
          "transform",
          `rotate(${angle.current} 80 80)`,
        );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const active = state !== "off";
  const arcColor =
    state === "running" ? "#7FC4EC" : state === "on" ? "#1591DC" : "#C5D0DC";
  const word =
    state === "running" ? "Running" : state === "on" ? "Idle" : "Paused";

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {active && (
        <div
          className="absolute h-28 w-28 rounded-full blur-2xl transition-colors duration-500"
          style={{ backgroundColor: arcColor, opacity: 0.12 }}
        />
      )}
      <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full">
        <circle
          cx="80"
          cy="80"
          r="70"
          fill="none"
          stroke="#E3EAF2"
          strokeWidth="2.5"
        />
        <g ref={arcRef}>
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={arcColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="130 310"
            style={{ transition: "stroke 0.5s" }}
          />
        </g>
      </svg>
      <p
        className="text-xs font-semibold uppercase tracking-[0.22em] transition-colors duration-300"
        style={{ color: active ? "#5B7490" : "#94A3B8" }}
      >
        {word}
      </p>
    </div>
  );
}

// ─── Agent log (live reasoning feed) ────────────────────────

// Activity = the permanent ledger. This log = the agent's live, granular
// thinking for its recent runs (monitors + rebalances), windowed + ephemeral.

type Step = {
  tag: string;
  tagCls: string;
  msg: React.ReactNode;
  detail: string;
};
type LogEntry = {
  id: number;
  kind: "monitor" | "rebalance" | "idle";
  mins: number; // run: minutes ago. idle (past): minutes idled.
  live?: boolean; // currently streaming run, or the current idle
  steps?: Step[]; // runs only
};

const G = "bg-[#EDF2F7] text-[#5B7490]"; // muted, monitors (heartbeat)
const B1 = "bg-[#EAF4FC] text-[#1591DC]"; // action, primary blue
const B2 = "bg-[#EAF4FC] text-[#2C5EAD]"; // signal
const GR = "bg-green-50 text-green-700"; // done (rebalanced)

// a real rebalance run streams these live, then settles into the feed
const REBALANCE_STEPS: Step[] = [
  {
    tag: "SCAN",
    tagCls: G,
    msg: "Checked the latest prices on your holdings",
    detail:
      "I pulled the latest oracle prices for everything you hold. cmETH at $3,241, sUSDe at $1.001, USDC steady at $1.00. Nothing looked stale, so I moved on to check whether anything had drifted enough to act on.",
  },
  {
    tag: "SIGNAL",
    tagCls: B2,
    msg: (
      <>
        cmETH is swinging more than usual lately{" "}
        <span className="font-medium text-[#0C1A2B]">(+12.4%)</span>
      </>
    ),
    detail:
      "cmETH has been choppy lately. Its 7-day volatility climbed 12.4% above its 30-day average, which usually means more short-term downside risk. I flagged this as a reason to consider trimming some exposure.",
  },
  {
    tag: "SIGNAL",
    tagCls: B2,
    msg: (
      <>
        sUSDe is paying a better yield right now{" "}
        <span className="font-medium text-[#0C1A2B]">(4.2%)</span>
      </>
    ),
    detail:
      "At the same time, sUSDe's yield widened to 4.2% APY, up from 3.6%. That's a more attractive risk-adjusted return than holding volatile cmETH right now, so it became the natural place to rotate into.",
  },
  {
    tag: "ANALYZE",
    tagCls: B1,
    msg: <>Checked this move against your guardrails, all clear</>,
    detail:
      "I checked your guardrails before doing anything. You're on Medium risk with a 50% cap per asset, and your notes say lean conservative near month-end. A shift toward sUSDe fits all of that, so nothing blocked the move.",
  },
  {
    tag: "DECIDE",
    tagCls: B1,
    msg: (
      <>
        Decided to move <span className="font-medium text-[#0C1A2B]">15%</span>{" "}
        from cmETH into sUSDe
      </>
    ),
    detail:
      "Best move: shift 15% out of cmETH into sUSDe. This lowers your volatility exposure while capturing the better yield. My confidence is 87%, mostly because both signals point the same direction and the move stays well inside your limits.",
  },
  {
    tag: "EXEC",
    tagCls: B1,
    msg: "Making the swap on-chain",
    detail:
      "I built the swap and broadcast it on-chain. Gas was tiny, about 0.0003 MNT. Now waiting for the transaction to confirm before updating your allocation.",
  },
  {
    tag: "DONE",
    tagCls: GR,
    msg: (
      <>
        Rebalanced your portfolio, est. APY up{" "}
        <span className="text-green-600">+0.3%</span>
      </>
    ),
    detail:
      "Done. Your portfolio is rebalanced and the estimated APY improved by about 0.3%/yr. I'll keep watching cmETH and rotate back if its volatility settles down below the threshold.",
  },
];

// routine scans that find nothing. varied so it never reads like a stuck loop.
const MONITOR_VARIANTS: Step[][] = [
  [
    {
      tag: "SCAN",
      tagCls: G,
      msg: "Checked prices on cmETH, sUSDe and USDC",
      detail:
        "Routine scheduled scan. Pulled fresh prices for everything you hold. Nothing looked stale.",
    },
    {
      tag: "ANALYZE",
      tagCls: B1,
      msg: "Everything within target, nothing drifted",
      detail:
        "No asset had drifted past its threshold and volatility was normal, so there was nothing worth acting on.",
    },
    {
      tag: "DONE",
      tagCls: GR,
      msg: "Watched your portfolio, nothing to do",
      detail:
        "Held everything as is. I'll look again at the next scheduled scan.",
    },
  ],
  [
    {
      tag: "SCAN",
      tagCls: G,
      msg: "Re-checked cmETH volatility and yields",
      detail:
        "Took another look at the asset that's been moving the most lately.",
    },
    {
      tag: "ANALYZE",
      tagCls: B1,
      msg: "cmETH drift 2.1%, under your 5% threshold",
      detail:
        "cmETH wandered a little but stayed comfortably inside the band you set, so no rebalance was warranted.",
    },
    {
      tag: "DONE",
      tagCls: GR,
      msg: "Holding, no action needed",
      detail: "Kept your allocation untouched.",
    },
  ],
  [
    {
      tag: "SCAN",
      tagCls: G,
      msg: "Scanned yields across your holdings",
      detail:
        "Compared the current yield on each asset against the alternatives.",
    },
    {
      tag: "ANALYZE",
      tagCls: B1,
      msg: "No better risk-adjusted rotation right now",
      detail:
        "Nothing offered enough extra return to justify the move and the gas, so rotating would not have helped you.",
    },
    {
      tag: "DONE",
      tagCls: GR,
      msg: "Staying put",
      detail: "Left everything where it is.",
    },
  ],
];

const WINDOW = 8; // keep ~8 recent entries (runs + idle markers); rest lives in Activity

// the live countdown is driven by the user's check-frequency guardrail
const freqSecs = (v: string) => (parseInt(v, 10) || 4) * 3600;
const ago = (m: number) =>
  m <= 0 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
const dur = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`);
const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
};

function AgentLog({
  running,
  onComplete,
  checkEvery,
}: {
  running: boolean;
  onComplete: () => void;
  checkEvery: string;
}) {
  const fSecs = freqSecs(checkEvery);
  const fMins = Math.round(fSecs / 60);
  const [feed, setFeed] = useState<LogEntry[]>(() => [
    { id: 1, kind: "idle", mins: 0, live: true },
    { id: 2, kind: "monitor", mins: 12, steps: MONITOR_VARIANTS[1] },
    { id: 3, kind: "idle", mins: fMins },
    { id: 4, kind: "rebalance", mins: 12 + fMins, steps: REBALANCE_STEPS },
    { id: 5, kind: "idle", mins: fMins },
    {
      id: 6,
      kind: "monitor",
      mins: 12 + 2 * fMins,
      steps: MONITOR_VARIANTS[2],
    },
  ]);
  const [openKey, setOpenKey] = useState("");
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [secs, setSecs] = useState(() => Math.max(60, fSecs - 12 * 60));
  const idRef = useRef(100);
  const vRef = useRef(0);
  const secsRef = useRef(Math.max(60, fSecs - 12 * 60));

  // idle: tick down to the next scheduled check (= check frequency). when it lands,
  // the agent runs (a monitor here) and the countdown resets to the full frequency.
  useEffect(() => {
    if (running) return;
    const t = setInterval(() => {
      secsRef.current -= 1;
      if (secsRef.current <= 0) {
        secsRef.current = fSecs;
        vRef.current += 1;
        const v = vRef.current % MONITOR_VARIANTS.length;
        setFeed((f) =>
          [
            { id: idRef.current++, kind: "idle" as const, mins: 0, live: true },
            {
              id: idRef.current++,
              kind: "monitor" as const,
              mins: 0,
              steps: MONITOR_VARIANTS[v],
            },
            ...f.map((e) =>
              e.live && e.kind === "idle"
                ? { ...e, live: false, mins: fMins }
                : { ...e, mins: e.mins + fMins },
            ),
          ].slice(0, WINDOW),
        );
      }
      setSecs(secsRef.current);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, checkEvery]);

  // run now: stream a rebalance run, then settle back into a fresh idle
  useEffect(() => {
    if (!running) return;
    const elapsed = Math.max(1, fMins - Math.round(secsRef.current / 60));
    setFeed((f) =>
      f[0]?.live && f[0]?.kind === "rebalance"
        ? f
        : [
            {
              id: idRef.current++,
              kind: "rebalance" as const,
              mins: 0,
              live: true,
              steps: REBALANCE_STEPS,
            },
            ...f.map((e) =>
              e.live && e.kind === "idle"
                ? { ...e, live: false, mins: elapsed }
                : e,
            ),
          ].slice(0, WINDOW),
    );
    setLiveCount(1);
    let i = 1;
    const t = setInterval(() => {
      i += 1;
      setLiveCount(i);
      if (i >= REBALANCE_STEPS.length) {
        clearInterval(t);
        setTimeout(() => {
          setLiveCount(null);
          secsRef.current = fSecs;
          setSecs(fSecs);
          setFeed((f) =>
            [
              {
                id: idRef.current++,
                kind: "idle" as const,
                mins: 0,
                live: true,
              },
              ...f.map((e) => (e.live ? { ...e, live: false, mins: 0 } : e)),
            ].slice(0, WINDOW),
          );
          onComplete();
        }, 900);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className="overflow-hidden rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white">
      <div className="px-3 py-2">
        {feed.map((entry) => {
          // idle marker — live = current waiting (ticking); past = a finished gap
          if (entry.kind === "idle") {
            if (entry.live) {
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  <span className="w-[4.5rem] shrink-0">
                    <span className="flex w-full justify-center rounded-md bg-[#EDF2F7] py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[#5B7490]">
                      Idle
                    </span>
                  </span>
                  <span className="flex flex-1 items-center gap-2 text-xs text-[#5B7490]">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1591DC] opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1591DC]" />
                    </span>
                    Watching your portfolio
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-[#94A3B8]">
                    next check in {clock(secs)}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1.5"
              >
                <span className="h-px flex-1 bg-[#F0F3F6]" />
                <span className="shrink-0 text-[10px] text-[#C5D0DC]">
                  idled {dur(entry.mins)}
                </span>
                <span className="h-px flex-1 bg-[#F0F3F6]" />
              </div>
            );
          }

          // a run (monitor / rebalance) renders its granular steps, newest step on top
          const isLive = !!entry.live && liveCount !== null;
          const steps = entry.steps ?? [];
          const revealed = isLive ? steps.slice(0, liveCount as number) : steps;
          const display = [...revealed].reverse();
          return (
            <div key={entry.id}>
              {display.map((s, di) => {
                const origIdx = revealed.length - 1 - di;
                const key = `${entry.id}-${origIdx}`;
                const isOpen = openKey === key;
                const isCursor = isLive && di === 0;
                return (
                  <div key={key} style={{ animation: "fadeIn .3s ease" }}>
                    <button
                      onClick={() => setOpenKey(isOpen ? "" : key)}
                      className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#F7F9FC]"
                    >
                      <span className="w-[4.5rem] shrink-0">
                        <span
                          className={`flex w-full justify-center rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${s.tagCls}`}
                        >
                          {s.tag}
                        </span>
                      </span>
                      <span
                        className={`flex-1 text-xs ${entry.kind === "rebalance" ? "text-[#0C1A2B]" : "text-[#5B7490]"}`}
                      >
                        {s.msg}
                        {isCursor && (
                          <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse rounded-[1px] bg-[#1591DC]" />
                        )}
                      </span>
                      {di === 0 && (
                        <span className="shrink-0 text-[10px] text-[#C5D0DC]">
                          {ago(entry.mins)}
                        </span>
                      )}
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-[#C5D0DC] transition-all group-hover:text-[#5B7490] ${isOpen ? "rotate-180 text-[#5B7490]" : ""}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                          }}
                          className="overflow-hidden"
                        >
                          <div className="my-1 ml-[5rem] mr-2 border-l-2 border-[#1591DC]/25 pl-3 text-xs leading-relaxed text-[#5B7490]">
                            {s.detail}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab 1: Control ─────────────────────────────────────────

// read-only mirror of the Guardrails tab, so the user can glance at what the
// agent is operating under before they hit Run / Pause.
function OperatingCard({
  config,
  onEdit,
}: {
  config: AgentConfig;
  onEdit: () => void;
}) {
  const risk = RISK_COPY[config.risk];
  const mix = RISK_MIX[config.risk];
  const [mixHover, setMixHover] = useState<number | null>(null);
  const mh = mixHover !== null ? mix[mixHover] : null;
  const mhCenter = mh
    ? mix.slice(0, mixHover!).reduce((s, m) => s + m.pct, 0) + mh.pct / 2
    : 0;
  const freqLabel =
    FREQ_PRESETS.find((f) => f.value === config.checkEvery)?.label ??
    config.checkEvery;
  const rows = [
    { k: "Check frequency", v: freqLabel },
    { k: "Max cap per asset", v: `${config.maxPerAsset}%` },
    { k: "Daily rebalances", v: `1 of ${config.dailyLimit} used` },
    {
      k: "Stop-loss",
      v: config.stopLoss.on ? `Armed at -${config.stopLoss.value}%` : "Off",
    },
  ];
  const heading =
    "text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]";
  const link =
    "flex items-center gap-1 text-[11px] font-medium text-[#1591DC] transition-opacity hover:opacity-70";
  return (
    <div className="flex flex-col">
      <SectionLabel>Agent Rules</SectionLabel>
      <div className="flex flex-1 flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
        {/* Risk level → set in Plan */}
        <div className="mb-2.5 flex items-center justify-between">
          <p className={heading}>Risk level</p>
          <Link href="/preview/plan" className={link}>
            Change
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#0C1A2B]">
            {config.risk} risk
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[#5B7490]">{risk.desc}</p>

        {/* Target mix — the basket this risk aims for (mirror of Plan), so the
            cockpit shows not just the rules but what they actually hold. */}
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] text-[#94A3B8]">
            Agent targets this mix
          </p>
          <div className="relative">
            <div className="flex h-2.5">
              {mix.map((m, i) => (
                <div
                  key={m.sym}
                  style={{
                    flexGrow: m.pct,
                    background: tokenColor(m.sym),
                    marginLeft: i === 0 ? 0 : -4,
                    zIndex: mix.length - i,
                  }}
                  className="relative basis-0 cursor-pointer rounded-[3px]"
                  onMouseEnter={() => setMixHover(i)}
                  onMouseLeave={() => setMixHover(null)}
                />
              ))}
            </div>
            <AnimatePresence>
              {mh && (
                <motion.div
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-[#0C1A2B] px-2.5 py-1.5 text-left shadow-lg"
                  style={{ left: `${mhCenter}%`, transformOrigin: "bottom center" }}
                  initial={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  <p className="text-xs font-semibold text-white">{mh.sym}</p>
                  <p className="text-[10px] text-white/55">{mh.pct}% of target</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {mix.map((m) => (
              <span
                key={m.sym}
                className="flex items-center gap-1 text-[10px] text-[#5B7490]"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tokenColor(m.sym) }}
                />
                {m.sym} {m.pct}%
              </span>
            ))}
          </div>
        </div>

        {/* Guardrails → edit in the Guardrails tab */}
        <div className="mb-2.5 mt-5 flex items-center justify-between border-t border-[#E8EAEC] pt-4">
          <p className={heading}>Guardrails</p>
          <button onClick={onEdit} className={link}>
            Edit
          </button>
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#5B7490]">{r.k}</span>
              <span className="text-xs font-medium text-[#0C1A2B]">{r.v}</span>
            </div>
          ))}
        </div>

        {/* User's note */}
        <div className="mt-5 border-t border-[#E8EAEC] pt-4">
          <p className={`mb-1.5 ${heading}`}>User&apos;s note</p>
          <p className="line-clamp-3 text-xs leading-relaxed text-[#5B7490]">
            {config.notes}
          </p>
        </div>
      </div>
    </div>
  );
}

function ControlTab({
  on,
  setOn,
  running,
  setRunning,
  countdown,
  config,
  onEditGuardrails,
}: {
  on: boolean;
  setOn: (f: (v: boolean) => boolean) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  countdown: number;
  config: AgentConfig;
  onEditGuardrails: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionLabel>Agent controls</SectionLabel>
          <div className="flex flex-1 flex-col items-center rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-6">
            <div className="mt-2">
              <AgentDial state={running ? "running" : on ? "on" : "off"} />
            </div>
            <p className="mt-1 text-xs text-[#5B7490]">
              {running ? (
                "executing rebalance"
              ) : on ? (
                <>
                  next run in{" "}
                  <span className="font-semibold tabular-nums text-[#0C1A2B]">
                    {fmtCountdown(countdown)}
                  </span>
                </>
              ) : (
                "agent is paused"
              )}
            </p>

            <div className="mt-4 flex w-[80%] max-w-xs items-center gap-2">
              <button
                onClick={() => setRunning(true)}
                disabled={!on || running}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1591DC] px-4 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {running ? "Running..." : "Run now"}
              </button>
              <button
                onClick={() => setOn((v) => !v)}
                disabled={running}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E8EAEC] bg-white px-4 py-2.5 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] disabled:opacity-40"
              >
                {on ? "Pause" : "Resume"}
              </button>
            </div>

            <div className="mt-auto grid w-full max-w-sm grid-cols-3 gap-3 border-t border-[#E8EAEC] pt-5 text-center">
              <div>
                <p className="flex justify-center text-lg font-semibold text-[#0C1A2B]">
                  <SlidingNumber number={47} />
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490]">
                  Rebalances
                </p>
              </div>
              <div>
                <p className="flex items-center justify-center text-lg font-semibold text-green-600">
                  +<SlidingNumber number={8.4} decimalPlaces={1} />%
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490]">
                  Est. APY
                </p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#0C1A2B]">2h ago</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490]">
                  Last run
                </p>
              </div>
            </div>
          </div>
        </div>

        <OperatingCard config={config} onEdit={onEditGuardrails} />
      </div>

      {/* Agent log — persistent terminal, streams live when running */}
      <div>
        <SectionLabel
          right={
            <Link
              href="/preview/activity"
              className="text-[11px] font-medium text-[#1591DC] transition-opacity hover:opacity-70"
            >
              See all records
            </Link>
          }
        >
          Agent log
        </SectionLabel>
        <AgentLog
          running={running}
          onComplete={() => setRunning(false)}
          checkEvery={config.checkEvery}
        />
      </div>
    </div>
  );
}

// ─── Tab 2: Chat (placeholder) ──────────────────────────────

function ChatTab() {
  return <AgentChat />;
}

// ExclusionField + avoid-token UI moved to Plan (composition lives with strategy);
// the shared picker is @/components/preview/ExclusionField.

// ─── Tab 3: Guardrails ──────────────────────────────────────

function GuardrailsTab({
  config,
  setConfig,
}: {
  config: AgentConfig;
  setConfig: (f: (c: AgentConfig) => AgentConfig) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<AgentConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));
  const num = (v: string) =>
    Math.max(0, parseInt(v.replace(/[^0-9]/g, ""), 10) || 0);

  return (
    <div className="space-y-6">
      {/* Limits */}
      <div>
        <SectionLabel right={<></>}>Limits</SectionLabel>
        <div className="divide-y divide-[#E8EAEC] rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white px-5">
          <GuardrailRow
            label="Check frequency"
            hint="How often the agent reviews the market"
          >
            <Dropdown
              value={config.checkEvery}
              options={FREQ_PRESETS}
              onChange={(v) => set({ checkEvery: v })}
              minW="min-w-[11rem]"
            />
          </GuardrailRow>
          <GuardrailRow
            label="Max per asset"
            hint="Cap allocation to any single token"
          >
            <NumInput
              value={config.maxPerAsset}
              suffix="%"
              onChange={(v) => set({ maxPerAsset: num(v) })}
            />
          </GuardrailRow>
          <GuardrailRow
            label="Daily rebalance limit"
            hint="Max rebalances per day, caps gas"
          >
            <NumInput
              value={config.dailyLimit}
              suffix="/ day"
              onChange={(v) => set({ dailyLimit: num(v) })}
            />
          </GuardrailRow>
        </div>
      </div>

      {/* Advanced */}
      <div>
        <SectionLabel
          right={
            <div className="flex items-center gap-2">
              {!advanced && (
                <span className="text-[10px] text-[#5B7490]">
                  Toggle to change
                </span>
              )}
              <Toggle sm on={advanced} onClick={() => setAdvanced((v) => !v)} />
            </div>
          }
        >
          Advanced
        </SectionLabel>
        <div
          className={`divide-y divide-[#E8EAEC] rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white px-5 ${
            advanced ? "" : "pointer-events-none select-none opacity-50"
          }`}
        >
          <GuardrailRow
            label="Min drift to act"
            hint="Only rebalance if off target by this much"
          >
            <NumInput
              value={config.minDrift}
              suffix="%"
              onChange={(v) => set({ minDrift: num(v) })}
            />
          </GuardrailRow>
          <GuardrailRow
            label="Stop-loss"
            hint="Exit an asset if it drops this much"
          >
            <div className="flex items-center gap-2">
              {config.stopLoss.on && (
                <NumInput
                  value={config.stopLoss.value}
                  suffix="%"
                  onChange={(v) =>
                    set({ stopLoss: { ...config.stopLoss, value: num(v) } })
                  }
                />
              )}
              <Toggle
                sm
                on={config.stopLoss.on}
                onClick={() =>
                  set({
                    stopLoss: { ...config.stopLoss, on: !config.stopLoss.on },
                  })
                }
              />
            </div>
          </GuardrailRow>
        </div>
      </div>

      {/* Agent notes */}
      <div>
        <SectionLabel right={<></>}>Personal Preferences</SectionLabel>
        <textarea
          rows={4}
          value={config.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="w-full resize-none rounded-xl border border-[#E8EAEC] bg-white p-4 text-sm leading-relaxed text-[#0C1A2B] outline-none focus:border-[#1591DC] focus:ring-1 focus:ring-[#1591DC]/20"
        />
        <p className="mt-1.5 text-xs text-[#5B7490]">
          Write instructions in plain language. The agent reads this before
          deciding any action.
        </p>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

const TABS = [
  { id: "control", label: "Control" },
  { id: "chat", label: "Chat" },
  { id: "guardrails", label: "Guardrails" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AgentPreview() {
  const [tab, setTab] = useState<Tab>("control");
  const [on, setOn] = useState(true);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState(18 * 60);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (!on || running) return;
    const id = setInterval(
      () => setCountdown((s) => (s <= 1 ? 18 * 60 : s - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [on, running]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
        Agent
      </h1>
      <p className="mt-1 text-sm text-[#5B7490]">
        Run the agent and set how it works.
      </p>

      <UnderlineTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        runningTab={running ? "control" : undefined}
      />

      <div key={tab} className="page-enter">
        {tab === "control" && (
          <ControlTab
            on={on}
            setOn={setOn}
            running={running}
            setRunning={setRunning}
            countdown={countdown}
            config={config}
            onEditGuardrails={() => setTab("guardrails")}
          />
        )}
        {tab === "chat" && <ChatTab />}
        {tab === "guardrails" && (
          <GuardrailsTab config={config} setConfig={setConfig} />
        )}

        {tab !== "chat" && <div className="h-12" />}
      </div>
    </div>
  );
}
