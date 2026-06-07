"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, History, Map } from "lucide-react";

/* Mobile bottom navigation (md:hidden). A plain, conventional tab bar — a white
   bar pinned to the bottom with a hairline top border; four icon + label tabs
   spread evenly; active = brand blue, inactive = muted grey. It rides its own
   compositing layer (transform-gpu + will-change) so the page-enter transform
   never flashes it. Account lives in the top-bar avatar, not here. */

const TABS = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Agent", href: "/agent", icon: Sparkles },
  { label: "Activity", href: "/activity", icon: History },
  { label: "Plan", href: "/plan", icon: Map },
];

// hide the bar while a text field is focused (keyboard up) so it never rides
// up with the keyboard on mobile
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);
    const sync = (v: boolean) => {
      setOpen(v);
      // body flag lets globals.css drop main's nav-clearance padding (the nav is
      // hidden, so that space would just be a gap above the keyboard); html flag
      // locks document scroll so the sticky composer can't unstick into a gap
      document.body.classList.toggle("kb-open", v);
      document.documentElement.classList.toggle("kb-open", v);
    };
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) sync(true);
    };
    const onOut = (e: FocusEvent) => {
      if (!isField(e.relatedTarget)) sync(false);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      document.body.classList.remove("kb-open");
      document.documentElement.classList.remove("kb-open");
    };
  }, []);
  return open;
}

export function BottomNav() {
  const pathname = usePathname();
  const keyboardOpen = useKeyboardOpen();

  return (
    <nav
      id="tends-bottomnav"
      className={`fixed inset-x-0 bottom-0 z-40 flex transform-gpu border-t border-edge bg-card pb-[env(safe-area-inset-bottom)] transition-transform duration-200 will-change-transform md:hidden ${
        keyboardOpen ? "translate-y-full" : ""
      }`}
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-label={t.label}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
          >
            <Icon
              className={`h-6 w-6 transition-colors ${
                active ? "text-brand" : "text-faint"
              }`}
              strokeWidth={active ? 2.4 : 2}
            />
            <span
              className={`text-[0.625rem] font-medium transition-colors ${
                active ? "text-brand" : "text-faint"
              }`}
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
