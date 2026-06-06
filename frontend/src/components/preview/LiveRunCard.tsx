"use client";

import { useState, useEffect, useRef } from "react";

/* ──────────────────────────────────────────────────────────
   Live Run Card — real-time agent execution tracker
   Tends style: light, Aspekta, blue tones.
   Inspired by autoclaw's Live Run Card, redesigned for Tends.
   ────────────────────────────────────────────────────────── */

type StepStatus = "pending" | "active" | "done";

interface Step {
  key: string;
  tag: string;
  label: string;
  // render rich data for this step
  render: () => React.ReactNode;
}

// ─── Rich data renderers per step ───────────────────────────

function PriceChips() {
  const prices = [
    { sym: "cmETH", price: "$3,241.02", color: "#2C5EAD" },
    { sym: "sUSDe", price: "$1.001", color: "#1591DC" },
    { sym: "USDC", price: "$1.000", color: "#4BB8FA" },
    { sym: "mETH", price: "$3,238.55", color: "#5B7490" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {prices.map((p) => (
        <div
          key={p.sym}
          className="flex items-center gap-2 rounded-lg bg-card px-3 py-1.5"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-xs font-semibold text-ink">{p.sym}</span>
          <span className="text-xs text-dim">{p.price}</span>
        </div>
      ))}
    </div>
  );
}

function SignalCards() {
  const signals = [
    {
      title: "cmETH volatility spike",
      detail: "7d volatility +12.4% above baseline",
      tone: "warn" as const,
      value: "+12.4%",
    },
    {
      title: "sUSDe yield widened",
      detail: "Spread now 4.2% APY (was 3.6%)",
      tone: "pos" as const,
      value: "4.2%",
    },
  ];
  return (
    <div className="space-y-2">
      {signals.map((s) => (
        <div key={s.title} className="flex items-center gap-3 rounded-lg bg-card p-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
              s.tone === "warn"
                ? "bg-warn-soft text-warn"
                : "bg-pos-soft text-pos"
            }`}
          >
            {s.tone === "warn" ? "↑" : "%"}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-ink">{s.title}</p>
            <p className="text-[0.6875rem] text-dim">{s.detail}</p>
          </div>
          <span
            className={`text-xs font-semibold ${
              s.tone === "warn" ? "text-warn" : "text-pos"
            }`}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function GuardrailChecks() {
  const checks = [
    { label: "Risk band: MEDIUM", pass: true },
    { label: "Max allocation per asset", pass: true },
    { label: "Daily rebalance limit", pass: true },
  ];
  return (
    <div className="space-y-1.5">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[0.625rem] text-pos">
            ✓
          </span>
          <span className="text-xs text-ink">{c.label}</span>
          <span className="ml-auto text-[0.625rem] font-medium text-pos">passed</span>
        </div>
      ))}
    </div>
  );
}

function DecisionCard() {
  return (
    <div className="rounded-lg bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-panel px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2C5EAD]" />
          <span className="text-[0.6875rem] font-medium text-ink">cmETH 40%</span>
        </div>
        <span className="text-dim">→</span>
        <div className="flex items-center gap-1.5 rounded-md bg-neg-soft px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          <span className="text-[0.6875rem] font-medium text-neg">cmETH 30%</span>
        </div>
        <span className="mx-1 text-faint">·</span>
        <div className="flex items-center gap-1.5 rounded-md bg-panel px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          <span className="text-[0.6875rem] font-medium text-ink">sUSDe 35%</span>
        </div>
        <span className="text-dim">→</span>
        <div className="flex items-center gap-1.5 rounded-md bg-pos-soft px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[0.6875rem] font-medium text-pos">sUSDe 45%</span>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[0.625rem] uppercase tracking-[0.08em] text-dim">
            Confidence
          </span>
          <span className="text-[0.6875rem] font-semibold text-brand">87%</span>
        </div>
        <div className="h-1.5 w-full rounded-[2px] bg-panel">
          <div className="h-1.5 rounded-[2px] bg-brand" style={{ width: "87%" }} />
        </div>
      </div>
    </div>
  );
}

function ExecCard() {
  return (
    <div className="rounded-lg bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          ⇄
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-ink">
            Swap cmETH → sUSDe
          </p>
          <p className="text-[0.6875rem] text-dim">Amount: $1,857.00</p>
        </div>
        <a className="text-[0.6875rem] font-medium text-brand hover:opacity-70">
          0x8c1b...3f9e ↗
        </a>
      </div>
    </div>
  );
}

function SummaryCard() {
  return (
    <div className="rounded-lg bg-pos-soft p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-pos">
            Portfolio rebalanced
          </p>
          <p className="text-[0.6875rem] text-pos/70">
            2 swaps executed · est. APY +0.3%/yr
          </p>
        </div>
        <button className="rounded-lg bg-card px-3 py-1.5 text-[0.6875rem] font-medium text-brand">
          View reasoning
        </button>
      </div>
    </div>
  );
}

// ─── Steps definition ───────────────────────────────────────

const STEPS: Step[] = [
  { key: "scan", tag: "SCAN", label: "Fetching latest prices", render: () => <PriceChips /> },
  { key: "signal", tag: "SIGNAL", label: "Market signals detected", render: () => <SignalCards /> },
  { key: "analyze", tag: "ANALYZE", label: "Checking guardrails", render: () => <GuardrailChecks /> },
  { key: "decide", tag: "DECIDE", label: "Rebalance decision", render: () => <DecisionCard /> },
  { key: "exec", tag: "EXEC", label: "Executing swaps", render: () => <ExecCard /> },
  { key: "done", tag: "DONE", label: "Complete", render: () => <SummaryCard /> },
];

const TAG_COLORS: Record<string, string> = {
  SCAN: "bg-panel text-dim",
  SIGNAL: "bg-warn-soft text-warn",
  ANALYZE: "bg-brand-soft text-brand",
  DECIDE: "bg-indigo-50 text-indigo-600",
  EXEC: "bg-purple-50 text-purple-600",
  DONE: "bg-pos-soft text-pos",
};

// ─── Status icon ────────────────────────────────────────────

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[0.6875rem] text-pos">
        ✓
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft">
        <svg className="h-3 w-3 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }
  return <div className="h-5 w-5 rounded-full border-2 border-edge" />;
}

// ─── Main component ─────────────────────────────────────────

export function LiveRunCard({
  autoStart = false,
  onComplete,
  hideButton = false,
}: {
  autoStart?: boolean;
  onComplete?: () => void;
  hideButton?: boolean;
}) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = idle, length = complete
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isRunning = currentStep >= 0 && currentStep < STEPS.length;
  const isComplete = currentStep >= STEPS.length;

  function run() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setCurrentStep(0);
    for (let i = 1; i <= STEPS.length; i++) {
      timers.current.push(setTimeout(() => setCurrentStep(i), i * 1400));
    }
    // notify parent after the final step has shown
    if (onComplete) {
      timers.current.push(setTimeout(onComplete, (STEPS.length + 1) * 1400));
    }
  }

  // auto-start once on mount when triggered externally
  useEffect(() => {
    if (autoStart) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function statusOf(i: number): StepStatus {
    if (currentStep > i) return "done";
    if (currentStep === i) return "active";
    return "pending";
  }

  // visible steps: show all up to and including current; when idle show none
  const visibleCount = currentStep < 0 ? 0 : Math.min(currentStep + 1, STEPS.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              isRunning ? "animate-pulse bg-brand" : isComplete ? "bg-pos-soft0" : "bg-edge"
            }`}
          />
          <span className="text-sm font-semibold text-ink">Tends Agent</span>
          <span className="text-xs text-dim">
            {isRunning ? "running now" : isComplete ? "rebalance complete" : "idle"}
          </span>
        </div>
        {!hideButton && (
          <button
            onClick={run}
            className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {isComplete || isRunning ? "Run again" : "Run agent"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {currentStep < 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-dim">
              Agent is monitoring the market.
            </p>
            <p className="mt-1 text-xs text-dim/70">
              Press &ldquo;Run agent&rdquo; to see a live rebalance cycle.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {STEPS.slice(0, visibleCount).map((step, i) => {
              const status = statusOf(i);
              const isLast = i === visibleCount - 1;
              return (
                <div key={step.key} className="flex gap-3">
                  {/* Left rail: icon + connecting line */}
                  <div className="flex flex-col items-center">
                    <StatusIcon status={status} />
                    {!isLast && <div className="my-1 w-px flex-1 bg-panel" />}
                  </div>

                  {/* Right: content */}
                  <div className={`flex-1 ${isLast ? "pb-1" : "pb-4"}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.05em] ${TAG_COLORS[step.tag]}`}
                      >
                        {step.tag}
                      </span>
                      <span className="text-xs font-medium text-ink">{step.label}</span>
                    </div>
                    {/* Rich data card */}
                    <div className="rounded-xl bg-panel p-3">{step.render()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
