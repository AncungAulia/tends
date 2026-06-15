"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, ArrowLeft, Wallet } from "lucide-react";
import VaultCard from "@/components/preview/VaultCard";

/* ──────────────────────────────────────────────────────────
   Onboarding mock — Tends
   Full-screen wizard (autoclaw-style): one question per screen,
   directional spring transitions, auto-advance on select.
   Answers → initial risk level + experience level.
   ────────────────────────────────────────────────────────── */

type Risk = "Low" | "Medium" | "High";

type Choice = { value: string; label: string; desc: string };

const GOAL: Choice[] = [
  { value: "safe", label: "Keep it safe", desc: "Grow slowly, don't lose it." },
  { value: "steady", label: "Grow it steadily", desc: "Steady growth, not too bumpy." },
  { value: "max", label: "Grow it as much as I can", desc: "Bigger ups and downs are okay." },
];
const DIPS: Choice[] = [
  { value: "out", label: "Take it out", desc: "I don't like losing money." },
  { value: "wait", label: "Leave it and wait", desc: "Ups and downs are normal." },
  { value: "add", label: "Put in more", desc: "A lower price is a good time to buy." },
];

// goal → risk (1:1). dips → stop-loss (di-derive di real app, lihat BACKEND_BRIEF)
const RISK_FROM_GOAL: Record<string, Risk> = {
  safe: "Low",
  steady: "Medium",
  max: "High",
};
type Answers = {
  name: string;
  goal?: string;
  dips?: string;
};

// step 0 connect · 1 name · 2 goal · 3 dips · 4 result
const LAST = 4;

const spring = { type: "spring", stiffness: 300, damping: 24 } as const;

export default function OnboardingPreview() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Answers>({ name: "" });
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const risk: Risk = RISK_FROM_GOAL[answers.goal ?? "steady"] ?? "Medium";

  const valid = useCallback(
    (s: number) => {
      if (s === 1) return answers.name.trim().length > 0;
      if (s === 2) return !!answers.goal;
      if (s === 3) return !!answers.dips;
      return true;
    },
    [answers],
  );

  const go = useCallback(
    (next: number) => {
      setDir(next > step ? 1 : -1);
      setStep(Math.max(0, Math.min(LAST, next)));
    },
    [step],
  );

  const forward = useCallback(() => {
    if (step < LAST && valid(step)) go(step + 1);
  }, [step, valid, go]);

  const pick = useCallback(
    (key: keyof Answers, value: string) => {
      setAnswers((p) => ({ ...p, [key]: value }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setDir(1);
        setStep((s) => Math.min(LAST, s + 1));
      }, 280);
    },
    [],
  );

  // keyboard: Enter forward · ArrowUp back · number keys pick on choice steps
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        forward();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (step > 0) go(step - 1);
      } else if (/^[1-3]$/.test(e.key)) {
        const list = step === 2 ? GOAL : step === 3 ? DIPS : null;
        if (list) {
          const opt = list[Number(e.key) - 1];
          const key = step === 2 ? "goal" : "dips";
          if (opt) pick(key as keyof Answers, opt.value);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, forward, go, pick]);

  const progress = Math.min(step, 3) / 3;

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink">
      {/* full-width progress bar, pinned to the very top */}
      <div className="h-1 w-full bg-edge">
        <motion.div
          className="h-full bg-brand"
          animate={{ width: `${progress * 100}%` }}
          transition={spring}
        />
      </div>
      {/* step counter, far right with whitespace */}
      <div className="flex h-6 justify-end px-6 pt-5">
        {step > 0 && step <= 3 && (
          <span className="text-xs font-medium tabular-nums text-faint">
            {step} of 3
          </span>
        )}
      </div>

      {/* step */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, y: dir * 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dir * -40 }}
              transition={spring}
            >
              {step === 0 && <ConnectWallet onConnect={forward} />}

              {step === 1 && (
                <div>
                  <StepHead title="First, what should we call you?" />
                  <input
                    autoFocus
                    value={answers.name}
                    onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && forward()}
                    placeholder="Your name"
                    className="w-full rounded-xl border-[1.25px] border-edge bg-card px-4 py-3 text-lg font-medium outline-none transition-all placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-[#1591DC]/15"
                  />
                  <NextButton onClick={forward} disabled={!valid(1)} />
                </div>
              )}

              {step === 2 && (
                <ChoiceStep
                  title="What do you want this money to do?"
                  options={GOAL}
                  selected={answers.goal}
                  onPick={(v) => pick("goal", v)}
                />
              )}

              {step === 3 && (
                <ChoiceStep
                  title="If your balance dropped 10% in a week, you would..."
                  options={DIPS}
                  selected={answers.dips}
                  onPick={(v) => pick("dips", v)}
                />
              )}

              {step === 4 && <Result name={answers.name} risk={risk} />}
            </motion.div>
          </AnimatePresence>

          {step > 0 && step < LAST && (
            <button
              onClick={() => go(step - 1)}
              className="mt-6 flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-dim"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h2>
      {sub && <p className="mt-1.5 text-sm text-dim">{sub}</p>}
    </div>
  );
}

function ChoiceStep({
  title,
  sub,
  options,
  selected,
  onPick,
}: {
  title: string;
  sub?: string;
  options: Choice[];
  selected?: string;
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <StepHead title={title} sub={sub} />
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const on = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onPick(opt.value)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border-[1.25px] p-4 text-left transition-colors ${
                on
                  ? "border-brand bg-brand-soft"
                  : "border-edge bg-card hover:border-edge2"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {opt.label}
                </span>
                <span className="block text-xs text-dim">{opt.desc}</span>
              </span>
              {on && <Check className="h-4 w-4 shrink-0 text-brand" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NextButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      Continue <ArrowRight className="h-4 w-4" />
    </button>
  );
}

// In the real app this button triggers Privy. In the preview it just advances.
function ConnectWallet({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">
        Let&apos;s set up your money
      </h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-dim">
        Connect your wallet to begin. It stays yours. Your agent can manage it,
        but can never move it out to itself.
      </p>
      <button
        onClick={onConnect}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Wallet className="h-4 w-4" /> Connect wallet
      </button>
      <p className="mt-4 text-xs text-faint">
        A minute of quick questions after this, then you&apos;re set.
      </p>
    </div>
  );
}

function Result({ name, risk }: { name: string; risk: Risk }) {
  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          {name ? `You're all set, ${name}!` : "You're all set!"}
        </h2>
        <p className="mt-1.5 text-sm text-dim">
          Your vault is ready. Your agent takes it from here.
        </p>
      </div>

      {/* the vault, shown like a card */}
      <VaultCard name={name} risk={risk} />

      <Link
        href="/preview/overview"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Enter Tends
      </Link>
    </div>
  );
}
