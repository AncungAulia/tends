"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAccount } from "wagmi";
import makeBlockie from "ethereum-blockies-base64";

/* Mobile top bar (md:hidden). No solid background — a fade scrim: the page
   colour holds opaque at the very top (under the notch) and melts to transparent
   below, so content scrolling up dissolves behind it instead of meeting a hard
   bar edge. The header is pointer-events-none so its transparent area never
   blocks taps on the content beneath; only the avatar and bell capture taps.
   It also auto-hides: slides up when you scroll down, back in when you scroll up. */

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

  return (
    <header
      className={`pointer-events-none sticky top-0 z-30 bg-linear-to-b from-app via-app to-transparent px-5 pb-4 pt-[calc(0.85rem+env(safe-area-inset-top))] transition-transform duration-300 ease-out md:hidden ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* identity */}
        <Link
          href="/account"
          className="pointer-events-auto flex min-w-0 items-center gap-2.5"
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
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">
              {address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : "Connect Wallet"}
            </p>
            {address && (
              <p className="text-[0.625rem] text-faint">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            )}
          </div>
        </Link>

        {/* alerts */}
        <button
          aria-label="Notifications"
          className="pointer-events-auto relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-card text-dim transition-colors hover:text-ink"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-[7px] top-[7px] h-1.5 w-1.5 rounded-full bg-brand ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
