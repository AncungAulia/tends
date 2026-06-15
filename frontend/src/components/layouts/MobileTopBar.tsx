"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import makeBlockie from "ethereum-blockies-base64";

/* Mobile top bar (md:hidden). No solid background — a fade scrim: the page
   colour holds opaque at the very top (under the notch) and melts to transparent
   below, so content scrolling up dissolves behind it instead of meeting a hard
   bar edge. The header is pointer-events-none so its transparent area never
   blocks taps on the content beneath; only the avatar captures taps.
   It also auto-hides: slides up when you scroll down, back in when you scroll up.

   Left = current page name (the mobile page indicator, since per-page <h1>s are
   hidden on mobile). Right = avatar → /account (account lives here, not in the
   bottom nav). */

// page name shown on the left — keyed by route
const PAGE_TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/agent": "Agent",
  "/activity": "Activity",
  "/setup": "Setup",
  "/account": "Account",
};

function titleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const hit = Object.entries(PAGE_TITLES).find(([href]) =>
    pathname.startsWith(href),
  );
  return hit?.[1] ?? "Tends";
}

// hide on scroll-down, reveal on scroll-up (past a small threshold)
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 6) {
        if (y > lastY && y > 72) setHidden(true);
        else if (y < lastY) setHidden(false);
        lastY = y;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

const BLOCKIE_GRID = [
  [1, 0, 1, 0, 1],
  [0, 1, 1, 1, 0],
  [1, 1, 0, 1, 1],
  [0, 0, 1, 0, 0],
  [1, 0, 0, 0, 1],
];

function BlockieFallback() {
  return (
    <div className="grid h-8 w-8 shrink-0 grid-cols-5 overflow-hidden rounded-full bg-[#BFE0F5]">
      {BLOCKIE_GRID.flat().map((on, i) => (
        <div key={i} style={{ background: on ? "#1591DC" : "transparent" }} />
      ))}
    </div>
  );
}

export function MobileTopBar() {
  const hidden = useHideOnScroll();
  const { address } = useAccount();
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <header
      className={`pointer-events-none sticky top-0 z-30 bg-linear-to-b from-app via-app to-transparent px-5 pb-4 pt-[calc(0.85rem+env(safe-area-inset-top))] transition-transform duration-300 ease-out md:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* current page name — the mobile "where am I" indicator */}
        <p className="min-w-0 truncate text-xl font-semibold tracking-[-0.02em] text-ink">
          {title}
        </p>

        {/* avatar → account */}
        <Link
          href="/account"
          aria-label="Account"
          aria-current={pathname.startsWith("/account") ? "page" : undefined}
          className="pointer-events-auto shrink-0 rounded-full"
        >
          {address ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={makeBlockie(address)}
              alt=""
              aria-hidden="true"
              className="h-8 w-8 shrink-0 rounded-full"
            />
          ) : (
            <BlockieFallback />
          )}
        </Link>
      </div>
    </header>
  );
}
