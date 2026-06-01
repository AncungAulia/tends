"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { LayoutDashboard, Activity, BarChart3, Settings, Wallet, LogOut } from "lucide-react";
import makeBlockie from "ethereum-blockies-base64";
import { AddressDisplay } from "@/components/elements/AddressDisplay";
import { cn } from "@/utils/cn";

const NAV = [
  { href: "/dashboard", label: "Portfolio", icon: LayoutDashboard },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { authenticated, login, logout } = usePrivy();

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

        <div className="mt-auto flex flex-col gap-3 px-3">
          {/* Wallet button */}
          {authenticated ? (
            <div className="flex items-center gap-2">
              {address && (
                <img
                  src={makeBlockie(address)}
                  alt=""
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0 rounded-sm"
                />
              )}
              <AddressDisplay address={address} className="flex-1 truncate" />
              <button
                onClick={() => logout()}
                aria-label="Disconnect wallet"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#5B7490] transition-colors hover:bg-[#F7F9FC] hover:text-red-500 dark:hover:bg-white/5 dark:hover:text-red-400"
              >
                <LogOut size={14} />
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
