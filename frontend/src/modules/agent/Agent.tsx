"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Play, Loader2, ChevronDown } from "lucide-react";
import { useAccount } from "wagmi";
import { useUserVault } from "@/hooks/useUserVault";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAgentActions } from "@/hooks/useAgentActions";
import { useAgentConfig } from "@/hooks/useAgentConfig";
import type { AgentConfig } from "@/hooks/useAgentConfig";
import { useAgentLogStream } from "@/hooks/useAgentLogStream";
import type { AgentLogEntry } from "@/hooks/useAgentLogStream";
import { useAgentLog } from "@/hooks/useAgentLog";
import type { AgentLogRow } from "@/hooks/useAgentLog";
import { useActivity } from "@/hooks/useActivityLog";
import SlidingNumber from "@/components/elements/SlidingNumber";
import { tokenColor } from "@/components/elements/TokenIcon";
import { AgentChat } from "@/modules/agent/component/AgentChat";

/* ──────────────────────────────────────────────────────────
   Agent module — Tends
   Command center: Control · Chat · Guardrails
   ────────────────────────────────────────────────────────── */

// ─── Risk labels & mix ──────────────────────────────────────

const RISK_LABELS: Record<number, string> = { 0: "Low", 1: "Medium", 2: "High", 3: "Custom" };

const RISK_MIX: Record<string, { sym: string; pct: number }[]> = {
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
  Custom: [
    { sym: "cmETH", pct: 34 },
    { sym: "mUSD", pct: 33 },
    { sym: "sUSDe", pct: 33 },
  ],
};

const RISK_COPY: Record<string, { dot: string; desc: string }> = {
  Low: { dot: "bg-green-500", desc: "Protects first, grows slowly" },
  Medium: { dot: "bg-yellow-400", desc: "Balances growth and safety" },
  High: { dot: "bg-orange-500", desc: "Chases yield, rides the swings" },
  Custom: { dot: "bg-brand", desc: "Your own mix, held on target" },
};

const FREQ_PRESETS = [
  { value: "1h", label: "Every 1 hour" },
  { value: "2h", label: "Every 2 hours" },
  { value: "4h", label: "Every 4 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Every 24 hours" },
];

// ─── Shared helpers ─────────────────────────────────────────

function Toggle({ on, onClick, sm }: { on: boolean; onClick: () => void; sm?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 rounded-full transition-colors ${sm ? "h-6 w-11" : "h-7 w-12"} ${on ? "bg-brand" : "bg-edge"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 rounded-full bg-white shadow-sm transition-transform ${sm ? "h-5 w-5" : "h-6 w-6"} ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
        {children}
      </p>
      {right}
    </div>
  );
}

function GuardrailRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

function NumInput({ value, suffix, onChange }: { value: string | number; suffix?: string; onChange?: (v: string) => void }) {
  const cls = "w-10 bg-transparent text-right text-sm font-semibold text-ink outline-none";
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-3 py-1.5">
      {onChange ? (
        <input value={String(value)} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input defaultValue={String(value)} className={cls} />
      )}
      {suffix && <span className="text-xs text-dim">{suffix}</span>}
    </div>
  );
}

function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function ago(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m <= 0) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// ─── Custom dropdown ─────────────────────────────────────────

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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-edge bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-edge2"
      >
        {current?.label ?? value}
        <ChevronDown className={`h-3.5 w-3.5 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={`absolute z-30 mt-1.5 ${minW} overflow-hidden rounded-xl border border-edge bg-card p-1 shadow-lg shadow-ink/8 ${align === "right" ? "right-0" : "left-0"}`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                  o.value === value
                    ? "bg-brand-soft font-medium text-brand"
                    : "text-ink hover:bg-panel"
                }`}
              >
                {o.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────

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
                ? "border-brand text-brand"
                : "border-transparent text-dim hover:text-ink"
            }`}
          >
            {t.label}
            {runningTab === t.id && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Agent Dial ───────────────────────────────────────────────

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
      speed.current += (targetRef.current - speed.current) * Math.min(1, dt * 3.5);
      if (targetRef.current === 0 && Math.abs(speed.current) < 0.4) speed.current = 0;
      angle.current = (angle.current + speed.current * dt) % 360;
      if (arcRef.current) arcRef.current.setAttribute("transform", `rotate(${angle.current} 80 80)`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const active = state !== "off";
  const arcColor = state === "running" ? "#7FC4EC" : state === "on" ? "#1591DC" : "#C5D0DC";
  const word = state === "running" ? "Running" : state === "on" ? "Idle" : "Paused";

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {active && (
        <div
          className="absolute h-28 w-28 rounded-full blur-2xl transition-colors duration-500"
          style={{ backgroundColor: arcColor, opacity: 0.12 }}
        />
      )}
      <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full">
        <circle cx="80" cy="80" r="70" fill="none" stroke="#E3EAF2" strokeWidth="2.5" />
        <g ref={arcRef}>
          <circle
            cx="80" cy="80" r="70" fill="none"
            stroke={arcColor} strokeWidth="3" strokeLinecap="round"
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

// ─── Agent Log ───────────────────────────────────────────────
// step → display label + badge color

const STEP_BADGE: Record<string, { label: string; cls: string }> = {
  "scan-vault":        { label: "SCAN",    cls: "bg-panel text-dim" },
  "signal-market":     { label: "SIGNAL",  cls: "bg-brand-soft text-brand" },
  "decide-allocation": { label: "DECIDE",  cls: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" },
  "exec-rebalance":    { label: "EXEC",    cls: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" },
  "direct-swap":       { label: "CHAT",    cls: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400" },
};

const STATUS_DOT: Record<string, string> = {
  done:  "bg-pos",
  skip:  "bg-edge2",
  error: "bg-neg",
};

function stepBadge(step: string) {
  return STEP_BADGE[step] ?? { label: step.slice(0, 6).toUpperCase(), cls: "bg-panel text-dim" };
}

function AgentLogFeed({ checkEvery, liveEntries = [] }: { checkEvery: string; liveEntries?: AgentLogEntry[] }) {
  const { logs } = useAgentLog(20);
  const fSecs = (parseInt(checkEvery, 10) || 4) * 3600;
  const [secs, setSecs] = useState(() => Math.max(60, fSecs - 12 * 60));
  const secsRef = useRef(secs);
  const [openKey, setOpenKey] = useState("");

  useEffect(() => {
    const t = setInterval(() => {
      secsRef.current -= 1;
      if (secsRef.current <= 0) secsRef.current = fSecs;
      setSecs(secsRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [fSecs]);

  // merge live SSE entries (top) + persisted DB entries (below)
  // de-duplicate by id so a fresh SSE entry doesn't double up once persisted
  const liveIds = new Set(liveEntries.map((e) => e.id));
  const historical = logs.filter((r) => !liveIds.has(r.id));

  const isEmpty = liveEntries.length === 0 && historical.length === 0;

  function humanDetail(step: string, data?: Record<string, unknown>): string {
    if (!data || Object.keys(data).length === 0) return "";
    switch (step) {
      case "scan-vault": {
        const rl = data.riskLevel as string ?? "";
        const hasNotes = data.hasUserNotes as boolean;
        if (!rl) return "";
        const r = rl.charAt(0) + rl.slice(1).toLowerCase();
        return `Running in ${r} risk mode.${hasNotes ? " Your investment policy is loaded." : ""}`;
      }
      case "signal-market": {
        const total = (data.totalValueUsd as number | undefined)?.toFixed(2);
        const count = data.liveCount as number | undefined;
        if (!total || !count) return "";
        return `${count} live price feeds loaded. Portfolio at $${total}.`;
      }
      case "decide-allocation": {
        const errors = data.errors as string[] | undefined;
        if (errors?.length) return `Validation failed: ${errors.join("; ")}`;
        const reasoning = data.reasoning as string | undefined;
        if (reasoning) return reasoning;
        const topTokens = data.topTokens as string | undefined;
        if (topTokens) return `Target mix: ${topTokens}.`;
        return "";
      }
      case "exec-rebalance":
      case "direct-swap": {
        const reasoning = data.reasoning as string | undefined;
        const hash = data.hash as string | undefined;
        const swaps = data.swaps as number | undefined;
        const parts: string[] = [];
        if (reasoning) parts.push(reasoning);
        if (hash) parts.push(`Tx: ${hash.slice(0, 10)}…${hash.slice(-6)}`);
        if (!reasoning && swaps) parts.push(`${swaps} swap${swaps !== 1 ? "s" : ""} executed on-chain.`);
        return parts.join("  ·  ");
      }
      default:
        return "";
    }
  }

  function renderDetail(step: string, data?: Record<string, unknown>) {
    const text = humanDetail(step, data);
    if (!text) return <span className="italic text-faint">no detail</span>;
    return <span>{text}</span>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border-[1.25px] border-edge bg-card">
      <div className="px-3 py-2">
        {/* idle row — always shown at top */}
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="w-[4.5rem] shrink-0">
            <span className="flex w-full justify-center rounded-md bg-panel py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-dim">
              Idle
            </span>
          </span>
          <span className="flex flex-1 items-center gap-2 text-xs text-dim">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Watching your portfolio
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-faint">
            next check in {clock(secs)}
          </span>
        </div>

        {/* live SSE entries */}
        {liveEntries.map((entry) => {
          const { label, cls } = stepBadge(entry.step);
          const isRunning = entry.status === "running";
          const key = entry.id;
          const isOpen = openKey === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpenKey(isOpen ? "" : key)}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-panel"
              >
                <span className="w-[4.5rem] shrink-0">
                  <span className={`flex w-full items-center justify-center gap-1 rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${cls}`}>
                    {isRunning && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                      </span>
                    )}
                    {label}
                  </span>
                </span>
                <span className="flex flex-1 items-center gap-1.5 truncate text-xs text-ink">
                  {!isRunning && (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[entry.status] ?? "bg-edge2"}`} />
                  )}
                  {entry.message}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-faint">
                  {ago(Date.now() - new Date(entry.ts).getTime())}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-faint transition-all group-hover:text-dim ${isOpen ? "rotate-180 text-dim" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <div className="my-1 ml-[5rem] mr-2 border-l-2 border-brand/25 pl-3 text-xs leading-relaxed text-dim">
                      {renderDetail(entry.step, entry.data)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* persisted historical entries */}
        {historical.map((row: AgentLogRow) => {
          const { label, cls } = stepBadge(row.step);
          const key = row.id;
          const isOpen = openKey === key;
          return (
            <div key={key}>
              <button
                onClick={() => setOpenKey(isOpen ? "" : key)}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-panel"
              >
                <span className="w-[4.5rem] shrink-0">
                  <span className={`flex w-full justify-center rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${cls}`}>
                    {label}
                  </span>
                </span>
                <span className="flex flex-1 items-center gap-1.5 truncate text-xs text-ink">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[row.status] ?? "bg-edge2"}`} />
                  {row.message}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-faint">
                  {ago(Date.now() - new Date(row.ts).getTime())}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-faint transition-all group-hover:text-dim ${isOpen ? "rotate-180 text-dim" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="overflow-hidden"
                  >
                    <div className="my-1 ml-[5rem] mr-2 border-l-2 border-brand/25 pl-3 text-xs leading-relaxed text-dim">
                      {renderDetail(row.step, row.data)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {isEmpty && (
          <p className="px-2 py-4 text-center text-xs text-faint">
            No runs yet — hit <span className="font-medium text-brand">Run now</span> to start
          </p>
        )}
      </div>
    </div>
  );
}

// ─── OperatingCard (read-only rules summary) ──────────────────

function OperatingCard({
  riskName,
  onEdit,
  agentConfig,
}: {
  riskName: string;
  onEdit: () => void;
  agentConfig?: AgentConfig;
}) {
  const risk = RISK_COPY[riskName] ?? RISK_COPY.Medium;
  const mix = RISK_MIX[riskName] ?? RISK_MIX.Medium;
  const [mixHover, setMixHover] = useState<number | null>(null);
  const mh = mixHover !== null ? mix[mixHover] : null;
  const mhCenter = mh
    ? mix.slice(0, mixHover!).reduce((s, m) => s + m.pct, 0) + mh.pct / 2
    : 0;
  const heading = "text-[10px] font-semibold uppercase tracking-[0.08em] text-faint";
  const link = "flex items-center gap-1 text-[11px] font-medium text-brand transition-opacity hover:opacity-70";
  const freq = cadenceToFreq(agentConfig?.cadenceSec);
  const maxPct = agentConfig?.maxPerAssetPct ?? DEFAULT_LOCAL.maxPerAssetPct;
  const dailyLimit = agentConfig?.dailyLimitPerDay ?? DEFAULT_LOCAL.dailyLimitPerDay;
  const slEnabled = agentConfig?.stopLossEnabled ?? DEFAULT_LOCAL.stopLossEnabled;
  const slPct = agentConfig?.stopLossPct ?? DEFAULT_LOCAL.stopLossPct;
  const rows = [
    { k: "Check frequency", v: `Every ${freq}` },
    { k: "Max cap per asset", v: `${maxPct}%` },
    { k: "Daily rebalances", v: `Up to ${dailyLimit} / day` },
    { k: "Stop-loss", v: slEnabled ? `Armed at -${slPct}%` : "Disabled" },
  ];

  return (
    <div className="flex flex-col">
      <SectionLabel>Agent Rules</SectionLabel>
      <div className="flex flex-1 flex-col rounded-2xl border-[1.25px] border-edge bg-card p-5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className={heading}>Risk level</p>
          <Link href="/plan" className={link}>Change</Link>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${risk.dot}`} />
          <span className="text-sm font-semibold text-ink">{riskName} risk</span>
        </div>
        <p className="mt-0.5 text-xs text-dim">{risk.desc}</p>

        <div className="mt-3">
          <p className="mb-1.5 text-[10px] text-faint">Agent targets this mix</p>
          <div className="relative">
            <div className="flex h-2.5">
              {mix.map((m, i) => (
                <div
                  key={m.sym}
                  style={{ flexGrow: m.pct, background: tokenColor(m.sym), marginLeft: i === 0 ? 0 : -4, zIndex: mix.length - i }}
                  className="relative basis-0 cursor-pointer rounded-[3px]"
                  onMouseEnter={() => setMixHover(i)}
                  onMouseLeave={() => setMixHover(null)}
                />
              ))}
            </div>
            <AnimatePresence>
              {mh && (
                <motion.div
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-left shadow-lg"
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
              <span key={m.sym} className="flex items-center gap-1 text-[10px] text-dim">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tokenColor(m.sym) }} />
                {m.sym} {m.pct}%
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2.5 mt-5 flex items-center justify-between border-t border-edge pt-4">
          <p className={heading}>Guardrails</p>
          <button onClick={onEdit} className={link}>Edit</button>
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3">
              <span className="text-xs text-dim">{r.k}</span>
              <span className="text-xs font-medium text-ink">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Control tab ──────────────────────────────────────────────

function ControlTab({
  paused,
  riskName,
  activityCount,
  onEditGuardrails,
  onPause,
  onResume,
  isPausing,
  onRunNow,
  isRunning,
  liveEntries,
  agentConfig,
}: {
  paused: boolean;
  riskName: string;
  activityCount: number;
  onEditGuardrails: () => void;
  onPause: () => void;
  onResume: () => void;
  isPausing: boolean;
  onRunNow: () => void;
  isRunning: boolean;
  liveEntries: AgentLogEntry[];
  agentConfig?: AgentConfig;
}) {
  const agentState = paused ? "off" : isRunning ? "running" : "on";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionLabel>Agent controls</SectionLabel>
          <div className="flex flex-1 flex-col items-center rounded-2xl border-[1.25px] border-edge bg-card p-6">
            <div className="mt-2">
              <AgentDial state={agentState} />
            </div>
            <p className="mt-1 text-xs text-dim">
              {paused ? "agent is paused" : isRunning ? "running rebalance..." : "watching your portfolio"}
            </p>

            <div className="mt-4 flex w-[80%] max-w-xs items-center gap-2">
              <button
                onClick={() => onRunNow()}
                disabled={isRunning}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? "Running..." : "Run now"}
              </button>
              <button
                onClick={paused ? onResume : onPause}
                disabled={isPausing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-edge bg-card px-4 py-2.5 text-xs font-medium text-dim transition-colors hover:border-dim hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPausing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {paused ? "Resume" : "Pause"}
              </button>
            </div>

            <div className="mt-auto grid w-full max-w-sm grid-cols-3 gap-3 border-t border-edge pt-5 text-center">
              <div>
                <p className="flex justify-center text-lg font-semibold text-ink">
                  <SlidingNumber number={activityCount} />
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-dim">Runs</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">{riskName}</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-dim">Strategy</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">Active</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-dim">Status</p>
              </div>
            </div>
          </div>
        </div>

        <OperatingCard riskName={riskName} onEdit={onEditGuardrails} agentConfig={agentConfig} />
      </div>

      <div>
        <SectionLabel
          right={
            <Link href="/activity" className="text-[11px] font-medium text-brand transition-opacity hover:opacity-70">
              See all records
            </Link>
          }
        >
          Agent log
        </SectionLabel>
        <AgentLogFeed checkEvery={cadenceToFreq(agentConfig?.cadenceSec)} liveEntries={liveEntries} />
      </div>
    </div>
  );
}

// ─── Guardrails tab ───────────────────────────────────────────

// Local UI state for the guardrails form (not the same as backend AgentConfig)
type LocalGuardrailState = {
  cadenceSec: number;
  maxPerAssetPct: number;
  dailyLimitPerDay: number;
  driftThresholdBps: number;
  stopLossEnabled: boolean;
  stopLossPct: number;
  notes: string;
};

const DEFAULT_LOCAL: LocalGuardrailState = {
  cadenceSec: 14400,
  maxPerAssetPct: 50,
  dailyLimitPerDay: 3,
  driftThresholdBps: 500,
  stopLossEnabled: true,
  stopLossPct: 10,
  notes: "Prefer stable yield on weekends. Lean conservative near month-end.",
};

function cadenceToFreq(secs: number | null | undefined): string {
  if (!secs) return "4h";
  const h = Math.round(secs / 3600);
  if (h <= 1) return "1h";
  if (h <= 2) return "2h";
  if (h <= 4) return "4h";
  if (h <= 12) return "12h";
  return "24h";
}

function freqToCadence(val: string): number {
  return parseInt(val, 10) * 3600;
}

function GuardrailsTab({
  config,
  onSave,
  isSaving,
  isLoading,
}: {
  config: AgentConfig | undefined;
  onSave: (patch: Partial<AgentConfig>) => Promise<unknown>;
  isSaving: boolean;
  isLoading: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  const [local, setLocal] = useState<LocalGuardrailState>(DEFAULT_LOCAL);

  // Sync local state when remote config loads
  useEffect(() => {
    if (!config) return;
    setLocal({
      cadenceSec: config.cadenceSec ?? DEFAULT_LOCAL.cadenceSec,
      maxPerAssetPct: config.maxPerAssetPct ?? DEFAULT_LOCAL.maxPerAssetPct,
      dailyLimitPerDay: config.dailyLimitPerDay ?? DEFAULT_LOCAL.dailyLimitPerDay,
      driftThresholdBps: config.driftThresholdBps ?? DEFAULT_LOCAL.driftThresholdBps,
      stopLossEnabled: config.stopLossEnabled ?? DEFAULT_LOCAL.stopLossEnabled,
      stopLossPct: config.stopLossPct ?? DEFAULT_LOCAL.stopLossPct,
      notes: config.notes ?? DEFAULT_LOCAL.notes,
    });
  }, [config]);

  const set = (patch: Partial<LocalGuardrailState>) => setLocal((c) => ({ ...c, ...patch }));
  const num = (v: string) => Math.max(0, parseInt(v.replace(/[^0-9]/g, ""), 10) || 0);

  const freqValue = cadenceToFreq(local.cadenceSec);

  async function handleSave() {
    await onSave({
      cadenceSec: local.cadenceSec,
      maxPerAssetPct: local.maxPerAssetPct,
      dailyLimitPerDay: local.dailyLimitPerDay,
      driftThresholdBps: local.driftThresholdBps,
      stopLossEnabled: local.stopLossEnabled,
      stopLossPct: local.stopLossEnabled ? local.stopLossPct : null,
      notes: local.notes,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-dim">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading guardrails…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel right={<></>}>Limits</SectionLabel>
        <div className="divide-y divide-edge rounded-2xl border-[1.25px] border-edge bg-card px-5">
          <GuardrailRow label="Check frequency" hint="How often the agent reviews the market">
            <Dropdown
              value={freqValue}
              options={FREQ_PRESETS}
              onChange={(v) => set({ cadenceSec: freqToCadence(v) })}
              minW="min-w-[11rem]"
            />
          </GuardrailRow>
          <GuardrailRow label="Max per asset" hint="Cap allocation to any single token">
            <NumInput value={local.maxPerAssetPct} suffix="%" onChange={(v) => set({ maxPerAssetPct: num(v) })} />
          </GuardrailRow>
          <GuardrailRow label="Daily rebalance limit" hint="Max rebalances per day, caps gas">
            <NumInput value={local.dailyLimitPerDay} suffix="/ day" onChange={(v) => set({ dailyLimitPerDay: num(v) })} />
          </GuardrailRow>
        </div>
      </div>

      <div>
        <SectionLabel
          right={
            <div className="flex items-center gap-2">
              {!advanced && <span className="text-[10px] text-dim">Toggle to change</span>}
              <Toggle sm on={advanced} onClick={() => setAdvanced((v) => !v)} />
            </div>
          }
        >
          Advanced
        </SectionLabel>
        <div className={`divide-y divide-edge rounded-2xl border-[1.25px] border-edge bg-card px-5 ${advanced ? "" : "pointer-events-none select-none opacity-50"}`}>
          <GuardrailRow label="Min drift to act" hint="Only rebalance if off target by this much (bps)">
            <NumInput value={local.driftThresholdBps} suffix="bps" onChange={(v) => set({ driftThresholdBps: num(v) })} />
          </GuardrailRow>
          <GuardrailRow label="Stop-loss" hint="Exit an asset if it drops this much">
            <div className="flex items-center gap-2">
              {local.stopLossEnabled && (
                <NumInput value={local.stopLossPct} suffix="%" onChange={(v) => set({ stopLossPct: num(v) })} />
              )}
              <Toggle sm on={local.stopLossEnabled} onClick={() => set({ stopLossEnabled: !local.stopLossEnabled })} />
            </div>
          </GuardrailRow>
        </div>
      </div>

      <div>
        <SectionLabel right={<></>}>Personal Preferences</SectionLabel>
        <textarea
          rows={4}
          value={local.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="w-full resize-none rounded-xl border border-edge bg-card p-4 text-sm leading-relaxed text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
        />
        <p className="mt-1.5 text-xs text-dim">
          Write instructions in plain language. The agent reads this before deciding any action.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const TABS = [
  { id: "control", label: "Control" },
  { id: "chat", label: "Chat" },
  { id: "guardrails", label: "Guardrails" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Agent() {
  const { address } = useAccount();
  const { vaultAddress } = useUserVault();
  const { currentLevel } = useRiskLevel(vaultAddress);
  const { paused } = usePortfolio(vaultAddress, address);
  const { activities } = useActivity();
  const { pause, resume, runHermes, isPausing, isRunning } = useAgentActions();
  const { config: agentConfig, isLoading: configLoading, save: saveConfig, isSaving } = useAgentConfig();
  const { liveEntries } = useAgentLogStream(vaultAddress);

  const riskName = RISK_LABELS[currentLevel ?? 1] ?? "Medium";

  const [tab, setTab] = useState<Tab>("control");

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
        Agent
      </h1>
      <p className="mt-1 text-sm text-dim">
        Run the agent and set how it works.
      </p>

      <UnderlineTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        runningTab={isRunning ? "control" : undefined}
      />

      <div key={tab}>
        {tab === "control" && (
          <ControlTab
            paused={paused}
            riskName={riskName}
            activityCount={activities.length}
            onEditGuardrails={() => setTab("guardrails")}
            onPause={pause}
            onResume={resume}
            isPausing={isPausing}
            onRunNow={runHermes}
            isRunning={isRunning}
            liveEntries={liveEntries}
            agentConfig={agentConfig}
          />
        )}
        {tab === "chat" && <AgentChat />}
        {tab === "guardrails" && (
          <GuardrailsTab
            config={agentConfig}
            onSave={saveConfig}
            isSaving={isSaving}
            isLoading={configLoading}
          />
        )}
        {tab !== "chat" && <div className="h-12" />}
      </div>
    </div>
  );
}
