"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if viewport width ≤ 768px.
 * Initialises as `false` (desktop) to avoid SSR mismatch,
 * then corrects on the client after mount.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
