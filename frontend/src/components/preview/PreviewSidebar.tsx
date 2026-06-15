"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  History,
  SlidersHorizontal,
  User,
  PanelLeftClose,
} from "lucide-react";

/* Shared sidebar for the /preview app shell.
   Collapses into an icon rail. Collapse = the PanelLeftClose button; expand =
   click the empty space between the nav and the profile. The trick for a smooth
   collapse: keep the SAME px-3 padding in both states so the icon never moves
   horizontally — only the width and the label change. State lives here so it
   survives navigation (the layout keeps this mounted across page changes). */

const NAV = [
  { label: "Overview", href: "/preview/overview", icon: LayoutDashboard },
  { label: "Agent", href: "/preview/agent", icon: Sparkles },
  { label: "Activity", href: "/preview/activity", icon: History },
  { label: "Setup", href: "/preview/setup", icon: SlidersHorizontal },
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

// label that slides out on hover while the rail is collapsed
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+0.6rem)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-tip px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}

export function PreviewSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col self-start border-r-[1.5px] border-edge bg-app px-3 py-5 transition-[width] duration-200 ease-out md:flex ${
        collapsed ? "w-16" : "w-52"
      }`}
    >
      {/* brand + collapse button (button shows only when expanded) */}
      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* black mark on light, white mark on dark (swapped via CSS so there's
              no theme-dependent JS / hydration flash) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon/Black-Tends.svg"
            alt="Tends"
            className="h-4 w-auto shrink-0 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon/White-Tends.svg"
            alt=""
            aria-hidden
            className="hidden h-4 w-auto shrink-0 dark:block"
          />
          {!collapsed && (
            <span className="whitespace-nowrap text-lg font-bold tracking-tight text-ink">
              Tends
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-dim transition-colors hover:bg-card hover:text-ink"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.label}
              href={n.href}
              className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                collapsed ? "" : "overflow-hidden"
              } ${
                active
                  ? "bg-brand-soft font-semibold text-brand"
                  : "text-dim hover:bg-card hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.3 : 2} />
              {collapsed ? (
                <Tip>{n.label}</Tip>
              ) : (
                <span className="whitespace-nowrap">{n.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* the gap between nav and profile — click it to expand when collapsed */}
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="flex-1 cursor-pointer"
        />
      ) : (
        <div className="flex-1" />
      )}

      <Link
        href="/preview/account"
        className={`group relative flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-card ${
          collapsed ? "" : "overflow-hidden"
        }`}
      >
        <Blockie />
        {collapsed ? (
          <Tip>ancung.eth</Tip>
        ) : (
          <div className="min-w-0 whitespace-nowrap">
            <p className="truncate text-xs font-semibold text-ink">
              ancung.eth
            </p>
            <p className="text-[0.625rem] text-dim">0x3f4a...c82b</p>
          </div>
        )}
      </Link>
    </aside>
  );
}
