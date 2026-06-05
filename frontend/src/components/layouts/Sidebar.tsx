"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import {
  LayoutDashboard,
  Sparkles,
  History,
  Map,
  User,
  Wallet,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import makeBlockie from "ethereum-blockies-base64";
import { AddressDisplay } from "@/components/elements/AddressDisplay";
import { cn } from "@/utils/cn";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/agent",    label: "Agent",    icon: Sparkles },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/plan",     label: "Plan",     icon: Map },
  { href: "/account",  label: "Account",  icon: User },
];

// tooltip that slides out on hover while the rail is collapsed
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.6rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#0C1A2B] px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}


export function Sidebar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { authenticated, login, logout } = usePrivy();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r-[1.5px] border-[#E8EAEC] bg-[#F9FBFC] px-3 py-5 transition-[width] duration-200 ease-out md:flex ${
          collapsed ? "w-16" : "w-52"
        }`}
      >
        {/* brand + collapse button */}
        <div className="flex items-center justify-between px-3">
          <Link href="/overview" className="flex items-center gap-2 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon/tends-black.svg" alt="Tends" className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="whitespace-nowrap text-lg font-bold tracking-tight text-[#0C1A2B]">
                Tends
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#5B7490] transition-colors hover:bg-white hover:text-[#0C1A2B]"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  collapsed ? "" : "overflow-hidden"
                } ${
                  active
                    ? "bg-[#EAF4FC] font-semibold text-[#1591DC]"
                    : "text-[#5B7490] hover:bg-white hover:text-[#0C1A2B]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.3 : 2} />
                {collapsed ? (
                  <Tip>{label}</Tip>
                ) : (
                  <span className="whitespace-nowrap">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* flex-1: click to expand when collapsed */}
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="flex-1 cursor-pointer"
          />
        ) : (
          <div className="flex-1" />
        )}

        {/* bottom section */}
        <div className="flex flex-col gap-2 pt-3">
          <div className={`flex flex-col gap-2 ${collapsed ? "" : "px-1"}`}>
            {authenticated ? (
              <div
                className={`group relative flex items-center gap-2 rounded-lg py-1 transition-colors hover:bg-white ${
                  collapsed ? "justify-center px-1" : "px-2"
                }`}
              >
                {address && (
                  <img
                    src={makeBlockie(address)}
                    alt=""
                    aria-hidden="true"
                    className="h-7 w-7 shrink-0 rounded-md"
                  />
                )}
                {collapsed ? (
                  <Tip>
                    {address
                      ? `${address.slice(0, 6)}...${address.slice(-4)}`
                      : "Account"}
                  </Tip>
                ) : (
                  <>
                    <AddressDisplay address={address} className="flex-1 truncate text-xs" />
                    <button
                      onClick={() => logout()}
                      aria-label="Disconnect wallet"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#5B7490] transition-colors hover:bg-[#F0F3F6] hover:text-red-500"
                    >
                      <LogOut size={13} />
                    </button>
                  </>
                )}
              </div>
            ) : (
              !collapsed && (
                <button
                  onClick={() => login()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1591DC] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1280C4]"
                >
                  <Wallet size={15} />
                  Connect Wallet
                </button>
              )
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#E8EAEC] bg-white py-2 md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[0.6rem]",
                active ? "text-[#1591DC]" : "text-[#5B7490]",
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
