"use client";

import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";

const spring = { type: "spring", stiffness: 300, damping: 24 } as const;

interface Props {
  step: number;
  dir: number;
  progress: number;
  showBack: boolean;
  onBack: () => void;
  children: React.ReactNode;
}

export function OnboardingShell({ step, dir, progress, showBack, onBack, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F9FBFC] text-[#0C1A2B]">
      {/* progress bar */}
      <div className="h-1 w-full bg-[#E8EAEC]">
        <motion.div
          className="h-full bg-[#1591DC]"
          animate={{ width: `${progress * 100}%` }}
          transition={spring}
        />
      </div>

      {/* step counter */}
      <div className="flex h-6 justify-end px-6 pt-5">
        {step > 0 && step <= 3 && (
          <span className="text-xs font-medium tabular-nums text-[#94A3B8]">{step} of 3</span>
        )}
      </div>

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
              {children}
            </motion.div>
          </AnimatePresence>

          {showBack && (
            <button
              onClick={onBack}
              className="mt-6 flex items-center gap-1.5 text-xs text-[#94A3B8] transition-colors hover:text-[#5B7490]"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
