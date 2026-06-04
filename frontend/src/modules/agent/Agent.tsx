"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Play, Loader2, ChevronDown } from "lucide-react";
import { useAccount } from "wagmi";
import { useUserVault } from "@/hooks/useUserVault";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import { useActivity } from "@/hooks/useActivityLog";
import { usePortfolio } from "@/hooks/usePortfolio";
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
  Custom: { dot: "bg-[#1591DC]", desc: "Your own mix, held on target" },
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
      className={`relative shrink-0 rounded-full transition-colors ${sm ? "h-6 w-11" : "h-7 w-12"} ${on ? "bg-[#1591DC]" : "bg-[#E8EAEC] dark:bg-white/15"}`}
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490] dark:text-white/45">
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
        <p className="text-sm font-medium text-[#0C1A2B] dark:text-white">{label}</p>
        {hint && <p className="text-xs text-[#5B7490] dark:text-white/45">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumInput({ value, suffix, onChange }: { value: string | number; suffix?: string; onChange?: (v: string) => void }) {
  const cls = "w-10 bg-transparent text-right text-sm font-semibold text-[#0C1A2B] outline-none dark:text-white";
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#E8EAEC] bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
      {onChange ? (
        <input value={String(value)} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input defaultValue={String(value)} className={cls} />
      )}
      {suffix && <span className="text-xs text-[#5B7490] dark:text-white/45">{suffix}</span>}
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
        className="flex items-center gap-2 rounded-lg border border-[#E8EAEC] bg-white px-3 py-1.5 text-sm font-medium text-[#0C1A2B] transition-colors hover:border-[#CBD5E1] dark:border-white/10 dark:bg-white/5 dark:text-white"
      >
        {current?.label ?? value}
        <ChevronDown className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={`absolute z-30 mt-1.5 ${minW} overflow-hidden rounded-xl border border-[#E8EAEC] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8 dark:border-white/10 dark:bg-[#0F2035] ${align === "right" ? "right-0" : "left-0"}`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                  o.value === value
                    ? "bg-[#EAF4FC] font-medium text-[#1591DC] dark:bg-[#1591DC]/15 dark:text-[#4BB8FA]"
                    : "text-[#0C1A2B] hover:bg-[#F7F9FC] dark:text-white dark:hover:bg-white/5"
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
                ? "border-[#1591DC] text-[#1591DC]"
                : "border-transparent text-[#5B7490] hover:text-[#0C1A2B] dark:text-white/45 dark:hover:text-white"
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

// ─── Agent Log (real data from useActivity + live idle countdown) ──

const G = "bg-[#EDF2F7] text-[#5B7490]";
const B1 = "bg-[#EAF4FC] text-[#1591DC]";
const GR = "bg-green-50 text-green-700";

type LogEntry = {
  id: string;
  kind: "monitor" | "rebalance" | "idle";
  label: string;
  minsAgo: number;
  live?: boolean;
};

function AgentLogFeed({ checkEvery }: { checkEvery: string }) {
  const { activities } = useActivity(8);
  const fSecs = (parseInt(checkEvery, 10) || 4) * 3600;
  const [secs, setSecs] = useState(() => Math.max(60, fSecs - 12 * 60));
  const [openKey, setOpenKey] = useState("");
  const secsRef = useRef(secs);

  useEffect(() => {
    const t = setInterval(() => {
      secsRef.current -= 1;
      if (secsRef.current <= 0) secsRef.current = fSecs;
      setSecs(secsRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [fSecs]);

  const feed: LogEntry[] = [
    { id: "idle-live", kind: "idle", label: "Watching your portfolio", minsAgo: 0, live: true },
    ...activities.map((a) => ({
      id: a.id,
      kind: (a.action === "REBALANCE" ? "rebalance" : "monitor") as "rebalance" | "monitor",
      label: a.action === "REBALANCE"
        ? "Rebalanced portfolio"
        : `${a.action.charAt(0) + a.action.slice(1).toLowerCase()} check`,
      minsAgo: Math.floor((Date.now() - a.timestamp.getTime()) / 60000),
    })),
  ];

  return (
    <div className="overflow-hidden rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white dark:border-white/8 dark:bg-[#0F2035]">
      <div className="px-3 py-2">
        {feed.map((entry) => {
          if (entry.kind === "idle" && entry.live) {
            return (
              <div key={entry.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="w-[4.5rem] shrink-0">
                  <span className="flex w-full justify-center rounded-md bg-[#EDF2F7] py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[#5B7490] dark:bg-white/10 dark:text-white/45">
                    Idle
                  </span>
                </span>
                <span className="flex flex-1 items-center gap-2 text-xs text-[#5B7490] dark:text-white/45">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1591DC] opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1591DC]" />
                  </span>
                  {entry.label}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-[#94A3B8] dark:text-white/30">
                  next check in {clock(secs)}
                </span>
              </div>
            );
          }

          const tagCls = entry.kind === "rebalance" ? B1 : G;
          const tag = entry.kind === "rebalance" ? "EXEC" : "SCAN";
          const key = entry.id;
          const isOpen = openKey === key;
          const mAgo = entry.minsAgo;
          const timeStr = mAgo <= 0 ? "just now" : mAgo < 60 ? `${mAgo}m ago` : `${Math.floor(mAgo / 60)}h ago`;

          return (
            <div key={key}>
              <button
                onClick={() => setOpenKey(isOpen ? "" : key)}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#F7F9FC] dark:hover:bg-white/5"
              >
                <span className="w-[4.5rem] shrink-0">
                  <span className={`flex w-full justify-center rounded-md py-0.5 text-[9px] font-semibold uppercase tracking-[0.05em] ${tagCls}`}>
                    {tag}
                  </span>
                </span>
                <span className={`flex-1 text-xs ${entry.kind === "rebalance" ? "text-[#0C1A2B] dark:text-white" : "text-[#5B7490] dark:text-white/45"}`}>
                  {entry.label}
                </span>
                <span className="shrink-0 text-[10px] text-[#C5D0DC] dark:text-white/20">{timeStr}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#C5D0DC] transition-all group-hover:text-[#5B7490] dark:text-white/20 ${isOpen ? "rotate-180 text-[#5B7490]" : ""}`} />
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
                    <div className="my-1 ml-[5rem] mr-2 border-l-2 border-[#1591DC]/25 pl-3 text-xs leading-relaxed text-[#5B7490] dark:text-white/45">
                      {entry.kind === "rebalance"
                        ? "The agent reviewed your portfolio and executed a rebalance to keep your allocation on target."
                        : "Routine check — prices and positions looked healthy, no action was needed."}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── OperatingCard (read-only rules summary) ──────────────────

function OperatingCard({
  riskName,
  onEdit,
}: {
  riskName: string;
  onEdit: () => void;
}) {
  const risk = RISK_COPY[riskName] ?? RISK_COPY.Medium;
  const mix = RISK_MIX[riskName] ?? RISK_MIX.Medium;
  const [mixHover, setMixHover] = useState<number | null>(null);
  const mh = mixHover !== null ? mix[mixHover] : null;
  const mhCenter = mh
    ? mix.slice(0, mixHover!).reduce((s, m) => s + m.pct, 0) + mh.pct / 2
    : 0;
  const heading = "text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8] dark:text-white/30";
  const link = "flex items-center gap-1 text-[11px] font-medium text-[#1591DC] transition-opacity hover:opacity-70 dark:text-[#4BB8FA]";
  const rows = [
    { k: "Check frequency", v: "Every 4 hours" },
    { k: "Max cap per asset", v: "50%" },
    { k: "Daily rebalances", v: "Up to 3 / day" },
    { k: "Stop-loss", v: "Armed at -10%" },
  ];

  return (
    <div className="flex flex-col">
      <SectionLabel>Agent Rules</SectionLabel>
      <div className="flex flex-1 flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 dark:border-white/8 dark:bg-[#0F2035]">
        <div className="mb-2.5 flex items-center justify-between">
          <p className={heading}>Risk level</p>
          <Link href="/plan" className={link}>Change</Link>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${risk.dot}`} />
          <span className="text-sm font-semibold text-[#0C1A2B] dark:text-white">{riskName} risk</span>
        </div>
        <p className="mt-0.5 text-xs text-[#5B7490] dark:text-white/45">{risk.desc}</p>

        <div className="mt-3">
          <p className="mb-1.5 text-[10px] text-[#94A3B8] dark:text-white/30">Agent targets this mix</p>
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
              <span key={m.sym} className="flex items-center gap-1 text-[10px] text-[#5B7490] dark:text-white/45">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: tokenColor(m.sym) }} />
                {m.sym} {m.pct}%
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2.5 mt-5 flex items-center justify-between border-t border-[#E8EAEC] pt-4 dark:border-white/8">
          <p className={heading}>Guardrails</p>
          <button onClick={onEdit} className={link}>Edit</button>
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#5B7490] dark:text-white/45">{r.k}</span>
              <span className="text-xs font-medium text-[#0C1A2B] dark:text-white">{r.v}</span>
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
}: {
  paused: boolean;
  riskName: string;
  activityCount: number;
  onEditGuardrails: () => void;
}) {
  const agentState = paused ? "off" : "on";
  const [localPaused, setLocalPaused] = useState(paused);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <SectionLabel>Agent controls</SectionLabel>
          <div className="flex flex-1 flex-col items-center rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-6 dark:border-white/8 dark:bg-[#0F2035]">
            <div className="mt-2">
              <AgentDial state={localPaused ? "off" : agentState} />
            </div>
            <p className="mt-1 text-xs text-[#5B7490] dark:text-white/45">
              {localPaused ? "agent is paused" : "watching your portfolio"}
            </p>

            <div className="mt-4 flex w-[80%] max-w-xs items-center gap-2">
              <button
                disabled
                title="Coming soon"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#1591DC] px-4 py-2.5 text-xs font-medium text-white opacity-40 cursor-not-allowed"
              >
                <Play className="h-3.5 w-3.5" />
                Run now
              </button>
              <button
                onClick={() => setLocalPaused((v) => !v)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E8EAEC] bg-white px-4 py-2.5 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] dark:border-white/10 dark:bg-white/5 dark:text-white/45 dark:hover:border-white/20 dark:hover:text-white"
              >
                {localPaused ? "Resume" : "Pause"}
              </button>
            </div>

            <div className="mt-auto grid w-full max-w-sm grid-cols-3 gap-3 border-t border-[#E8EAEC] pt-5 text-center dark:border-white/8">
              <div>
                <p className="flex justify-center text-lg font-semibold text-[#0C1A2B] dark:text-white">
                  <SlidingNumber number={activityCount} />
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490] dark:text-white/45">Runs</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#0C1A2B] dark:text-white">{riskName}</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490] dark:text-white/45">Strategy</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#0C1A2B] dark:text-white">Active</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-[#5B7490] dark:text-white/45">Status</p>
              </div>
            </div>
          </div>
        </div>

        <OperatingCard riskName={riskName} onEdit={onEditGuardrails} />
      </div>

      <div>
        <SectionLabel
          right={
            <Link href="/activity" className="text-[11px] font-medium text-[#1591DC] transition-opacity hover:opacity-70 dark:text-[#4BB8FA]">
              See all records
            </Link>
          }
        >
          Agent log
        </SectionLabel>
        <AgentLogFeed checkEvery="4h" />
      </div>
    </div>
  );
}

// ─── Guardrails tab ───────────────────────────────────────────

type AgentConfig = {
  checkEvery: string;
  maxPerAsset: number;
  dailyLimit: number;
  minDrift: number;
  stopLoss: { on: boolean; value: number };
  notes: string;
};

const DEFAULT_CONFIG: AgentConfig = {
  checkEvery: "4h",
  maxPerAsset: 50,
  dailyLimit: 3,
  minDrift: 5,
  stopLoss: { on: true, value: 10 },
  notes: "Prefer stable yield on weekends. Lean conservative near month-end.",
};

function GuardrailsTab({ config, setConfig }: { config: AgentConfig; setConfig: (f: (c: AgentConfig) => AgentConfig) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<AgentConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const num = (v: string) => Math.max(0, parseInt(v.replace(/[^0-9]/g, ""), 10) || 0);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel right={<></>}>Limits</SectionLabel>
        <div className="divide-y divide-[#E8EAEC] rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white px-5 dark:divide-white/8 dark:border-white/8 dark:bg-[#0F2035]">
          <GuardrailRow label="Check frequency" hint="How often the agent reviews the market">
            <Dropdown value={config.checkEvery} options={FREQ_PRESETS} onChange={(v) => set({ checkEvery: v })} minW="min-w-[11rem]" />
          </GuardrailRow>
          <GuardrailRow label="Max per asset" hint="Cap allocation to any single token">
            <NumInput value={config.maxPerAsset} suffix="%" onChange={(v) => set({ maxPerAsset: num(v) })} />
          </GuardrailRow>
          <GuardrailRow label="Daily rebalance limit" hint="Max rebalances per day, caps gas">
            <NumInput value={config.dailyLimit} suffix="/ day" onChange={(v) => set({ dailyLimit: num(v) })} />
          </GuardrailRow>
        </div>
      </div>

      <div>
        <SectionLabel
          right={
            <div className="flex items-center gap-2">
              {!advanced && <span className="text-[10px] text-[#5B7490] dark:text-white/45">Toggle to change</span>}
              <Toggle sm on={advanced} onClick={() => setAdvanced((v) => !v)} />
            </div>
          }
        >
          Advanced
        </SectionLabel>
        <div className={`divide-y divide-[#E8EAEC] rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white px-5 dark:divide-white/8 dark:border-white/8 dark:bg-[#0F2035] ${advanced ? "" : "pointer-events-none select-none opacity-50"}`}>
          <GuardrailRow label="Min drift to act" hint="Only rebalance if off target by this much">
            <NumInput value={config.minDrift} suffix="%" onChange={(v) => set({ minDrift: num(v) })} />
          </GuardrailRow>
          <GuardrailRow label="Stop-loss" hint="Exit an asset if it drops this much">
            <div className="flex items-center gap-2">
              {config.stopLoss.on && (
                <NumInput value={config.stopLoss.value} suffix="%" onChange={(v) => set({ stopLoss: { ...config.stopLoss, value: num(v) } })} />
              )}
              <Toggle sm on={config.stopLoss.on} onClick={() => set({ stopLoss: { ...config.stopLoss, on: !config.stopLoss.on } })} />
            </div>
          </GuardrailRow>
        </div>
      </div>

      <div>
        <SectionLabel right={<></>}>Personal Preferences</SectionLabel>
        <textarea
          rows={4}
          value={config.notes}
          onChange={(e) => set({ notes: e.target.value })}
          className="w-full resize-none rounded-xl border border-[#E8EAEC] bg-white p-4 text-sm leading-relaxed text-[#0C1A2B] outline-none focus:border-[#1591DC] focus:ring-1 focus:ring-[#1591DC]/20 dark:border-white/10 dark:bg-[#0F2035] dark:text-white"
        />
        <p className="mt-1.5 text-xs text-[#5B7490] dark:text-white/45">
          Write instructions in plain language. The agent reads this before deciding any action.
        </p>
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

  const riskName = RISK_LABELS[currentLevel ?? 1] ?? "Medium";

  const [tab, setTab] = useState<Tab>("control");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B] dark:text-white">
        Agent
      </h1>
      <p className="mt-1 text-sm text-[#5B7490] dark:text-white/45">
        Run the agent and set how it works.
      </p>

      <UnderlineTabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label }))}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div key={tab}>
        {tab === "control" && (
          <ControlTab
            paused={paused}
            riskName={riskName}
            activityCount={activities.length}
            onEditGuardrails={() => setTab("guardrails")}
          />
        )}
        {tab === "chat" && <AgentChat />}
        {tab === "guardrails" && <GuardrailsTab config={config} setConfig={setConfig} />}
        {tab !== "chat" && <div className="h-12" />}
      </div>
    </div>
  );
}
