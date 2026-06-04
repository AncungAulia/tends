"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Sparkles,
  History,
  Map,
  User,
  Wallet,
  LogOut,
  ChevronDown,
} from "lucide-react";
import makeBlockie from "ethereum-blockies-base64";
import { AddressDisplay } from "@/components/elements/AddressDisplay";
import { tokenColor } from "@/components/elements/TokenIcon";
import { cn } from "@/utils/cn";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { useVaultStore } from "@/hooks/useVaultStore";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/agent",    label: "Agent",    icon: Sparkles },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/plan",     label: "Plan",     icon: Map },
  { href: "/account",  label: "Account",  icon: User },
];

// Collapsible holdings peek — top 3 by USD value, shown as bar + rows.
function HoldingsPeek() {
  const [open, setOpen] = useState(false);
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { holdings, totalValueUSD, isLoading } = useVaultHoldings(vaultAddress);

  const top3 = holdings.slice(0, 3);
  const hasData = top3.length > 0;

  return (
    <div className="rounded-xl border-[1.25px] border-[#E8EAEC] bg-white dark:border-white/8 dark:bg-white/4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-[#0C1A2B] dark:text-white/80"
      >
        Holdings
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[#94A3B8] transition-transform dark:text-white/30",
            open && "rotate-180",
          )}
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
              {isLoading && (
                <p className="text-[0.6875rem] text-[#94A3B8] dark:text-white/30">
                  Loading…
                </p>
              )}
              {!isLoading && !hasData && (
                <p className="text-[0.6875rem] text-[#94A3B8] dark:text-white/30">
                  No holdings yet
                </p>
              )}
              {!isLoading && hasData && (
                <>
                  {/* Proportional color bar */}
                  <div className="flex h-1.5 overflow-hidden rounded-full">
                    {top3.map((h) => {
                      const pct =
                        totalValueUSD > 0 && h.valueUSD != null
                          ? (h.valueUSD / totalValueUSD) * 100
                          : 0;
                      return (
                        <div
                          key={h.symbol}
                          style={{
                            flexGrow: pct,
                            background: tokenColor(h.symbol),
                          }}
                        />
                      );
                    })}
                  </div>
                  {/* Rows */}
                  {top3.map((h) => {
                    const pct =
                      totalValueUSD > 0 && h.valueUSD != null
                        ? ((h.valueUSD / totalValueUSD) * 100).toFixed(0)
                        : "—";
                    return (
                      <div
                        key={h.symbol}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-[#0C1A2B] dark:text-white/80">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: tokenColor(h.symbol) }}
                          />
                          {h.symbol}
                        </span>
                        <span className="text-[0.6875rem] text-[#94A3B8] dark:text-white/40">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { authenticated, login, logout } = usePrivy();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r-[1.5px] border-[#E8EAEC] bg-[#F9FBFC] px-3 py-5 dark:border-white/8 dark:bg-[#0F2035] md:flex">
        <Link href="/overview" className="flex items-center gap-2 px-3 py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon/tends-black.svg" alt="Tends" className="h-6 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon/tends-white.svg" alt="Tends" className="hidden h-6 w-auto dark:block" />
          <span className="font-sans text-base font-bold tracking-tight text-[#0C1A2B] dark:text-white">
            Tends
          </span>
        </Link>

        <nav className="mt-6 flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#EAF4FC] font-semibold text-[#1591DC] dark:bg-[#1591DC]/15 dark:text-[#4BB8FA]"
                    : "text-[#5B7490] hover:bg-white hover:text-[#0C1A2B] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-3">
          {/* Holdings peek — only shown when authenticated */}
          {authenticated && <HoldingsPeek />}

          <div className="flex flex-col gap-2 px-1">
            {authenticated ? (
              <div className="flex items-center gap-2 rounded-lg px-2 py-2">
                {address && (
                  <img
                    src={makeBlockie(address)}
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 shrink-0 rounded-sm"
                  />
                )}
                <AddressDisplay address={address} className="flex-1 truncate text-xs" />
                <button
                  onClick={() => logout()}
                  aria-label="Disconnect wallet"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#5B7490] transition-colors hover:bg-[#F0F3F6] hover:text-red-500 dark:hover:bg-white/5 dark:hover:text-red-400"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => login()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1591DC] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1280C4]"
              >
                <Wallet size={15} />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#E8EAEC] bg-white py-2 dark:border-white/8 dark:bg-[#0F2035] md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[0.6rem]",
                active
                  ? "text-[#1591DC] dark:text-[#4BB8FA]"
                  : "text-[#5B7490] dark:text-white/45",
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
