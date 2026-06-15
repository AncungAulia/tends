"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Download,
  Repeat,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { Drawer as Vaul } from "vaul";
import SlidingNumber from "@/components/preview/SlidingNumber";

/* ──────────────────────────────────────────────────────────
   Activity page mock — Tends
   Summary stat cards · filters · full history
   ────────────────────────────────────────────────────────── */

// ─── Summary stat cards (mini bar sparklines) ───────────────

// cards settle in one-by-one on first paint
const CARD_CONTAINER: Variants = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const CARD_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

// mini bar sparkline — sparse weeks render as faint stubs so a gap still reads
function Sparkbars({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="mt-3 flex h-9 items-end gap-1">
      {data.map((v, i) => (
        <div key={i} className="flex h-full flex-1 items-end">
          <motion.div
            className="w-full rounded-[2px]"
            style={{
              height: `${Math.max(10, (v / max) * 100)}%`,
              background: color,
              opacity: v === 0 ? 0.16 : 1,
              transformOrigin: "bottom",
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.45, delay: 0.12 + i * 0.05, ease: "easeOut" }}
          />
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  sub,
  bars,
  color,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  sub: string;
  bars: number[];
  color: string;
  tone?: "pos" | "neg";
}) {
  const c =
    tone === "pos"
      ? "text-pos"
      : tone === "neg"
        ? "text-neg"
        : "text-ink";
  return (
    <motion.div
      variants={CARD_ITEM}
      className="rounded-2xl border-[1.25px] border-edge bg-card p-5"
    >
      <p className="text-[0.625rem] font-semibold uppercase tracking-widest text-faint">
        {label}
      </p>
      <p
        className={`mt-1.5 flex items-center text-[1.75rem] font-semibold leading-none tracking-[-0.03em] ${c}`}
      >
        {prefix}
        <SlidingNumber className="inline-flex" number={value} decimalPlaces={decimals} />
        {suffix}
      </p>
      <Sparkbars data={bars} color={color} />
      <p className="mt-3 text-[0.6875rem] text-dim">{sub}</p>
    </motion.div>
  );
}

function SummaryStats({ period }: { period: string }) {
  return (
    <motion.div
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      initial="hidden"
      animate="show"
      variants={CARD_CONTAINER}
    >
      <StatCard
        label="Rebalances"
        value={12}
        sub={`agent moves in ${period}`}
        bars={[2, 3, 2, 4, 1]}
        color="#1591DC"
      />
      <StatCard
        label="Deposited"
        value={2500}
        prefix="+$"
        tone="pos"
        sub="across 3 deposits"
        bars={[1000, 0, 1000, 0, 500]}
        color="#16A34A"
      />
      <StatCard
        label="Withdrawn"
        value={500}
        prefix="-$"
        tone="neg"
        sub="1 withdrawal"
        bars={[0, 0, 500, 0, 0]}
        color="#DC2626"
      />
    </motion.div>
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
function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
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
        className="flex items-center gap-1.5 rounded-full border-[1.25px] border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-dim"
      >
        {value}
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
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors hover:bg-panel ${
                p === value ? "font-semibold text-brand" : "text-dim"
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
  Rebalance: "bg-brand-soft text-brand",
  Deposit: "bg-pos-soft text-pos",
  Withdraw: "bg-neg-soft text-neg",
  Monitor: "bg-panel text-dim",
};

const STEP_TAG: Record<string, string> = {
  SCAN: "bg-panel text-dim",
  SIGNAL: "bg-brand-soft text-brand",
  ANALYZE: "bg-brand-soft text-brand",
  DECIDE: "bg-brand-soft text-brand",
  EXEC: "bg-brand-soft text-brand",
  DONE: "bg-pos-soft text-pos",
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

// per-type glyph for the mobile card rows
const ACT_ICON: Record<Act["type"], LucideIcon> = {
  Rebalance: Repeat,
  Deposit: ArrowDownLeft,
  Withdraw: ArrowUpRight,
  Monitor: Eye,
};

// desktop → right-side drawer, mobile → Vaul bottom sheet. Defaults to mobile so
// SSR/first paint match; resolves after mount (the sheet only opens on tap, well
// after hydration, so there's no flash).
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

// ─── Activity row (clickable → opens drawer) ────────────────

function Row({ a, onClick }: { a: Act; onClick: () => void }) {
  const impactColor =
    a.impactTone === "pos"
      ? "text-pos"
      : a.impactTone === "neg"
        ? "text-neg"
        : "text-faint";
  const Icon = ACT_ICON[a.type];
  return (
    <>
      {/* desktop: compact table row */}
      <button
        onClick={onClick}
        className="hidden w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-panel md:flex"
      >
        <span className="w-12 shrink-0 font-mono text-[0.6875rem] text-faint">
          {a.time}
        </span>
        <span
          className={`w-24 shrink-0 rounded-md px-2 py-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[a.type]}`}
        >
          {a.type}
        </span>
        <span className="flex-1 truncate text-sm text-ink">{a.desc}</span>
        <span
          className={`w-24 shrink-0 text-right text-xs font-medium ${impactColor}`}
        >
          {a.impact}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>

      {/* mobile: icon-led card row — desc gets the full width it needs */}
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors active:bg-panel md:hidden"
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TAG[a.type]}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-ink">
              {a.desc}
            </p>
            {a.impact !== "—" && (
              <span className={`shrink-0 text-xs font-semibold ${impactColor}`}>
                {a.impact}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-faint">
              {a.type}
            </span>
            <span className="h-0.5 w-0.5 rounded-full bg-edge2" />
            <span className="font-mono text-[0.625rem] text-faint">
              {a.time}
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-faint" />
      </button>
    </>
  );
}

// ─── Shared detail body (agent steps timeline / user-tx reasoning) ──

function ActBody({ act }: { act: Act }) {
  if (act.steps) {
    return (
      <>
        <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-widest text-faint">
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
                  <span className="my-1 w-px flex-1 bg-edge" />
                )}
              </div>
              <div
                className={`flex-1 ${i < act.steps!.length - 1 ? "pb-5" : ""}`}
              >
                <span
                  className={`inline-block rounded-md px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider ${STEP_TAG[s.tag]}`}
                >
                  {s.tag}
                </span>
                <p className="mt-1.5 text-sm text-ink">{s.msg}</p>
                <p className="mt-1 text-xs leading-relaxed text-dim">
                  {s.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-widest text-faint">
        Details
      </p>
      <p className="text-sm leading-relaxed text-dim">{act.reasoning}</p>
    </>
  );
}

// ─── Mobile detail (Vaul bottom sheet — draggable, scroll-locked) ───

function MobileDetailSheet({
  act,
  onClose,
}: {
  act: Act | null;
  onClose: () => void;
}) {
  const impactColor =
    act?.impactTone === "pos"
      ? "text-pos"
      : act?.impactTone === "neg"
        ? "text-neg"
        : "text-faint";
  return (
    <Vaul.Root open={!!act} onOpenChange={(o) => !o && onClose()}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-tip/30 backdrop-blur-[1px]" />
        <Vaul.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-edge bg-card outline-none"
        >
          {/* grabber */}
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-edge" />
          {act && (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[act.type]}`}
                  >
                    {act.type}
                  </span>
                  <Vaul.Title className="mt-2 text-base font-semibold text-ink">
                    {act.desc}
                  </Vaul.Title>
                  <p className="mt-0.5 text-xs text-dim">
                    {act.day} · {act.time}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${impactColor}`}>
                  {act.impact}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <ActBody act={act} />
              </div>
            </>
          )}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
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
      ? "text-pos"
      : act?.impactTone === "neg"
        ? "text-neg"
        : "text-faint";
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      {/* backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-tip/25 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* panel */}
      <div
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {act && (
          <>
            <div className="flex items-start justify-between border-b border-edge p-5">
              <div>
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[act.type]}`}
                >
                  {act.type}
                </span>
                <p className="mt-2 text-base font-semibold text-ink">
                  {act.desc}
                </p>
                <p className="mt-0.5 text-xs text-dim">
                  {act.day} · {act.time}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-[1.25px] border-edge text-dim transition-colors hover:border-ink hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className={`text-sm font-semibold ${impactColor}`}>
                  {act.impact}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ActBody act={act} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ActivityPreview() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Act | null>(null);
  const isDesktop = useIsDesktop();
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
      <div className="mx-auto max-w-5xl px-4 pb-2 md:px-8 md:py-8">
          {/* Header: title + period + export */}
          <div className="mb-5 flex items-center justify-between">
            <div className="hidden md:block">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
                Activity
              </h1>
              <p className="mt-1 text-sm text-dim">
                Every move the agent and you have made.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {period === "Custom range" && (
                <div className="flex items-center gap-1.5 rounded-full border-[1.25px] border-edge bg-card px-3 py-1">
                  <span className="text-[0.6875rem] font-medium text-faint">
                    From
                  </span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="bg-transparent text-xs text-ink outline-none [color-scheme:light]"
                  />
                  <span className="text-[0.6875rem] font-medium text-faint">
                    to
                  </span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="bg-transparent text-xs text-ink outline-none [color-scheme:light]"
                  />
                </div>
              )}
              {/* <PeriodDropdown value={period} onChange={setPeriod} />
              <button className="flex items-center gap-1.5 rounded-full border-[1.25px] border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-dim transition-colors hover:border-dim hover:text-ink">
                <Download className="h-3.5 w-3.5" /> Export
              </button> */}
            </div>
          </div>

          {/* Summary stat cards
          <div className="mb-6">
            <SummaryStats period={periodLabel} />
          </div> */}

          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-edge bg-card text-dim hover:text-ink"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-full border-[1.25px] border-edge bg-card px-3 py-1.5 focus-within:border-brand">
              <Search className="h-3.5 w-3.5 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search activity"
                className="w-36 bg-transparent text-xs text-ink outline-none placeholder:text-faint"
              />
            </div>
          </div>

          {/* History table */}
          <div className="rounded-2xl border-[1.25px] border-edge bg-card p-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-faint">
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
                  <p className="px-3 pb-1 pt-3 text-[0.625rem] font-semibold uppercase tracking-widest text-faint">
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
                  className="rounded-full border-[1.25px] border-edge bg-card px-5 py-2 text-xs font-medium text-dim transition-colors hover:border-dim hover:text-ink"
                >
                  Load more
                </button>
              ) : (
                <p className="text-[0.6875rem] text-faint">
                  You&apos;re all caught up
                </p>
              )}
            </div>
          )}

          <div className="h-12" />
      </div>

      {isDesktop ? (
        <Drawer act={selected} onClose={() => setSelected(null)} />
      ) : (
        <MobileDetailSheet act={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
