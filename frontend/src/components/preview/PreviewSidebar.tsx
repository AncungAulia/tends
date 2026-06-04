"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, History, Map, User } from "lucide-react";

/* Shared sidebar for the /preview app shell.
   Real navigation: each item routes to its preview page, active = current path. */

const NAV = [
  { label: "Overview", href: "/preview/overview", icon: LayoutDashboard },
  { label: "Agent", href: "/preview/agent", icon: Sparkles },
  { label: "Activity", href: "/preview/activity", icon: History },
  { label: "Plan", href: "/preview/plan", icon: Map },
  { label: "Account", href: "/preview/account", icon: User },
];

export function PreviewSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col self-start border-r-[1.5px] border-[#E8EAEC] bg-white px-3 py-5 md:flex">
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
                  : "text-[#5B7490] hover:bg-[#F7F9FC] hover:text-[#0C1A2B]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.3 : 2} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t-[1.5px] border-[#E8EAEC] px-2 pt-3">
        <div className="h-7 w-7 rounded-full bg-linear-to-br from-[#1591DC] to-purple-500" />
        <div>
          <p className="text-xs font-semibold text-[#0C1A2B]">ancung.eth</p>
          <p className="text-[10px] text-[#5B7490]">0x3f4a...c82b</p>
        </div>
      </div>
    </aside>
  );
}
