"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Sparkles,
  History,
  Map,
  User,
  ChevronDown,
} from "lucide-react";
import { tokenColor } from "@/components/preview/TokenIcon";

/* Shared sidebar for the /preview app shell.
   Real navigation: each item routes to its preview page, active = current path. */

const NAV = [
  { label: "Overview", href: "/preview/overview", icon: LayoutDashboard },
  { label: "Agent", href: "/preview/agent", icon: Sparkles },
  { label: "Activity", href: "/preview/activity", icon: History },
  { label: "Plan", href: "/preview/plan", icon: Map },
  { label: "Account", href: "/preview/account", icon: User },
];

// mock blockies identicon — symmetric pixel grid (real app: derive from address)
const BLOCKIE = [
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [1, 1, 0, 1, 1],
  [0, 0, 1, 0, 0],
  [1, 0, 0, 0, 1],
];

function Blockie() {
  return (
    <div className="grid h-7 w-7 shrink-0 grid-cols-5 overflow-hidden rounded-md bg-[#BFE0F5]">
      {BLOCKIE.flat().map((on, i) => (
        <div key={i} style={{ background: on ? "#1591DC" : "transparent" }} />
      ))}
    </div>
  );
}

const HOLDINGS = [
  { sym: "mUSD", pct: 40, val: "$4,972" },
  { sym: "mETH", pct: 30, val: "$3,729" },
  { sym: "cmETH", pct: 30, val: "$3,729" },
];

// collapsible holdings peek — glance at the vault from any page
function Holdings() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border-[1.25px] border-[#E8EAEC] bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#0C1A2B]"
      >
        Holdings
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 px-3 pb-3">
              <div className="flex h-1.5 overflow-hidden rounded-full">
                {HOLDINGS.map((h) => (
                  <div
                    key={h.sym}
                    style={{ flexGrow: h.pct, background: tokenColor(h.sym) }}
                  />
                ))}
              </div>
              {HOLDINGS.map((h) => (
                <div key={h.sym} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-[#0C1A2B]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: tokenColor(h.sym) }}
                    />
                    {h.sym}
                  </span>
                  <span className="text-[0.6875rem] text-[#94A3B8]">
                    {h.pct}% · {h.val}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PreviewSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col self-start border-r-[1.5px] border-[#E8EAEC] bg-[#F9FBFC] px-3 py-5 md:flex">
      <div className="flex items-center gap-2 px-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon/tends-black.svg" alt="Tends" className="h-7 w-auto" />
        <span className="text-lg font-bold tracking-tight text-[#0C1A2B]">
          Tends
        </span>
      </div>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.label}
              href={n.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-[#EAF4FC] font-semibold text-[#1591DC]"
                  : "text-[#5B7490] hover:bg-white hover:text-[#0C1A2B]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.3 : 2} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 pt-3">
        <Holdings />
        <Link
          href="/preview/account"
          className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-white"
        >
          <Blockie />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#0C1A2B]">
              ancung.eth
            </p>
            <p className="text-[0.625rem] text-[#5B7490]">0x3f4a...c82b</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
