"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { LayoutDashboard, Activity, BarChart3, Settings } from "lucide-react";
import makeBlockie from "ethereum-blockies-base64";
import { AddressDisplay } from "@/components/elements/AddressDisplay";
import { cn } from "@/utils/cn";
import type { WSStatus } from "@/hooks/useDashboardWS";

const NAV = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const WS_DOT: Record<WSStatus, string> = {
  connected: "bg-[#16A34A]",
  connecting: "bg-[#D97706]",
  disconnected: "bg-[#5B7490]",
};

const WS_LABEL: Record<WSStatus, string> = {
  connected: "connected",
  connecting: "connecting",
  disconnected: "disconnected",
};

export function Sidebar({ wsStatus = "connecting" }: { wsStatus?: WSStatus }) {
  const pathname = usePathname();
  const { address } = useAccount();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[#DDE8F2] bg-white px-4 py-6 dark:border-white/8 dark:bg-[#0F2035] md:flex">
        <Link
          href="/dashboard"
          className="px-3 font-sans text-xl font-bold tracking-tight text-[#0C1A2B] dark:text-white"
        >
          Tends.
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#EAF4FC] font-medium text-[#2C5EAD] dark:bg-[#1591DC]/10 dark:text-[#4BB8FA]"
                    : "text-[#5B7490] hover:bg-[#F7F9FC] hover:text-[#0C1A2B] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-3">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", WS_DOT[wsStatus])} />
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
              {WS_LABEL[wsStatus]}
            </span>
            <span className="sr-only">Connection: {WS_LABEL[wsStatus]}</span>
          </div>
          <div className="flex items-center gap-2">
            {address && (
              <img
                src={makeBlockie(address)}
                alt=""
                aria-hidden="true"
                className="h-6 w-6 rounded-sm"
              />
            )}
            <AddressDisplay address={address} />
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#DDE8F2] bg-white py-2 dark:border-white/8 dark:bg-[#0F2035] md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
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
