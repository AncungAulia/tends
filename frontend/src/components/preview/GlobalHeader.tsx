"use client";

import { useState, useRef, useEffect } from "react";
import { Play, BookOpen, ChevronDown, ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ──────────────────────────────────────────────────────────
   Global header — Tends
   Right-aligned: Run agent · Help · Move Money dropdown
   ────────────────────────────────────────────────────────── */

function MoveMoney() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-[#1591DC] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        Funds
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 overflow-hidden rounded-xl border border-[#DDE8F2] bg-white p-1 shadow-lg shadow-[#0C1A2B]/5"
          >
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F7F9FC]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF4FC] text-[#1591DC]">
                <ArrowDownLeft className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0C1A2B]">Deposit</p>
                <p className="text-[0.625rem] text-[#5B7490]">Add funds to vault</p>
              </div>
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[#F7F9FC]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7F9FC] text-[#5B7490]">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#0C1A2B]">Withdraw</p>
                <p className="text-[0.625rem] text-[#5B7490]">Take funds out</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GlobalHeader({
  onRunAgent,
  running = false,
  bgClass = "bg-white",
  borderClass = "border-b border-[#DDE8F2]",
}: {
  onRunAgent?: () => void;
  running?: boolean;
  bgClass?: string;
  borderClass?: string;
}) {
  return (
    <header className={`sticky top-0 z-20 flex h-14 items-center justify-end gap-2 ${borderClass} ${bgClass} px-8`}>
      {/* Run agent */}
      <button
        onClick={onRunAgent}
        disabled={running}
        className="flex items-center gap-1.5 rounded-full border border-[#DDE8F2] bg-white px-3.5 py-2 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-[#DDE8F2]"
      >
        {running ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1591DC]" />
            <span className="text-[#1591DC]">Running...</span>
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            Run agent
          </>
        )}
      </button>

      {/* Help */}
      <button
        aria-label="How to use Tends"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#5B7490] transition-colors hover:bg-slate-200 hover:text-[#0C1A2B]"
      >
        <BookOpen className="h-4 w-4" />
      </button>

      {/* Move Money */}
      <MoveMoney />
    </header>
  );
}
