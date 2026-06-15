"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { GOAL, DIPS, RISK_FROM_GOAL, STOPLOSS } from "@/components/onboarding/constants";
import type { Risk, Answers } from "@/components/onboarding/types";

export const ONBOARDING_LAST = 4;

export function useOnboardingWizard() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Answers>({ name: "" });
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const risk: Risk = RISK_FROM_GOAL[answers.goal ?? "steady"] ?? "Medium";
  const stopLoss = STOPLOSS[answers.dips ?? "wait"] ?? 10;
  const progress = Math.min(step, 3) / 3;

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
      setStep(Math.max(0, Math.min(ONBOARDING_LAST, next)));
    },
    [step],
  );

  const forward = useCallback(() => {
    if (step < ONBOARDING_LAST && valid(step)) go(step + 1);
  }, [step, valid, go]);

  const pick = useCallback(
    (key: keyof Answers, value: string) => {
      setAnswers((p) => ({ ...p, [key]: value }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        setDir(1);
        setStep((s) => Math.min(ONBOARDING_LAST, s + 1));
      }, 280);
    },
    [],
  );

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

  return { step, dir, answers, setAnswers, risk, stopLoss, progress, forward, pick, go, valid };
}
