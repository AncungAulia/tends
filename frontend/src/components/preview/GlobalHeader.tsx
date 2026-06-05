"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bell,
  ArrowLeftRight,
  ArrowDownLeft,
  TrendingDown,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ──────────────────────────────────────────────────────────
   Global header — Tends
   The header carries what's true from ANY page, not a page's own
   actions. For an agent-managed app that means: the agent heartbeat
   (is my money being handled?) + an alert channel (did it do something
   I should know?) + help. Money lives on Overview, run lives on Agent.
   ────────────────────────────────────────────────────────── */

// agent states share the Overview cockpit palette so chrome and page agree
const AGENT = {
  idle: { dot: "#1591DC", label: "watching", note: "next run in 18m", live: true },
  running: { dot: "#8CC8EE", label: "working", note: "making a move", live: true },
  paused: { dot: "#B4C0CE", label: "paused", note: "tap to resume", live: false },
} as const;

function Heartbeat({ state = "idle" as keyof typeof AGENT }) {
  const s = AGENT[state];
  return (
    <Link
      href="/preview/agent"
      className="-ml-1.5 flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 transition-colors hover:bg-white"
    >
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {s.live && (
          <motion.span
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{ background: s.dot }}
            initial={{ scale: 1, opacity: 0.35 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 2.4, ease: "easeOut", repeat: Infinity }}
          />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: s.dot }}
        />
      </span>
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="text-[0.8125rem] font-medium text-[#0C1A2B]">
          Agent {s.label}
        </span>
        <span className="text-xs text-[#94A3B8]">· {s.note}</span>
      </span>
    </Link>
  );
}

// ─── Notifications ──────────────────────────────────────────

type Notif = {
  id: number;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  fg: string;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
};

// only the noteworthy stuff lands here (routine scans stay in Activity).
// each one is the agent telling you what it did with your money.
const NOTIFS: Notif[] = [
  {
    id: 1,
    Icon: ArrowLeftRight,
    tint: "bg-[#EAF4FC]",
    fg: "text-[#1591DC]",
    title: "Rebalanced your portfolio",
    body: "Moved 15% from cmETH into sUSDe",
    time: "2h",
    unread: true,
  },
  {
    id: 2,
    Icon: ArrowDownLeft,
    tint: "bg-green-50",
    fg: "text-green-600",
    title: "Deposit landed",
    body: "$500 added and put to work",
    time: "1d",
    unread: true,
  },
  {
    id: 3,
    Icon: TrendingDown,
    tint: "bg-amber-50",
    fg: "text-amber-600",
    title: "cmETH dipped 6%",
    body: "Still within your limits, holding for now",
    time: "2d",
  },
];

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(NOTIFS);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.some((n) => n.unread);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#5B7490] transition-colors hover:bg-slate-200 hover:text-[#0C1A2B]"
      >
        <Bell className="h-4 w-4" />
        {unread && (
          <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#1591DC] ring-2 ring-slate-100" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-2xl border border-[#E8EAEC] bg-white shadow-xl shadow-[#0C1A2B]/8"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
              <p className="text-sm font-semibold text-[#0C1A2B]">
                Notifications
              </p>
              {unread && (
                <button
                  onClick={() =>
                    setItems((xs) => xs.map((n) => ({ ...n, unread: false })))
                  }
                  className="text-[0.6875rem] font-medium text-[#1591DC] transition-opacity hover:opacity-70"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto pb-1">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href="/preview/activity"
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-2.5 transition-colors hover:bg-[#F7F9FC]"
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.tint} ${n.fg}`}
                  >
                    <n.Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.8125rem] font-medium text-[#0C1A2B]">
                      {n.title}
                    </p>
                    <p className="truncate text-xs text-[#5B7490]">{n.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    {n.unread && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1591DC]" />
                    )}
                    <span className="text-[0.625rem] tabular-nums text-[#94A3B8]">
                      {n.time}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/preview/activity"
              onClick={() => setOpen(false)}
              className="block border-t border-[#E8EAEC] py-2.5 text-center text-xs font-medium text-[#5B7490] transition-colors hover:bg-[#F7F9FC] hover:text-[#0C1A2B]"
            >
              See all activity
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GlobalHeader({
  bgClass = "bg-white",
  borderClass = "border-b border-[#DDE8F2]",
}: {
  bgClass?: string;
  borderClass?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-20 flex h-14 items-center justify-between gap-2 ${borderClass} ${bgClass} px-8`}
    >
      <Heartbeat />

      <div className="flex items-center gap-2">
        <Notifications />
        <button
          aria-label="How to use Tends"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[#5B7490] transition-colors hover:bg-slate-200 hover:text-[#0C1A2B]"
        >
          <BookOpen className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
