"use client";

import { useReducedMotion } from "motion/react";

/* Shared motion tokens for the preview app (ported from autoclaw).
   Use via useMotionSafe() so everything respects prefers-reduced-motion. */

export const MOTION = {
  fadeIn: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } },
  fadeUp: { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
  spring: { type: "spring", stiffness: 300, damping: 24 },
  springSnappy: { type: "spring", stiffness: 400, damping: 20 },
  duration: { fast: 0.15, normal: 0.3, slow: 0.5 },
} as const;

// reduced-motion fallback: no offset, instant
export const MOTION_NOOP = {
  fadeIn: { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } },
  fadeUp: { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } },
  spring: { duration: 0 },
  springSnappy: { duration: 0 },
  duration: { fast: 0, normal: 0, slow: 0 },
} as const;

export function useMotionSafe() {
  const reduced = useReducedMotion();
  return reduced ? MOTION_NOOP : MOTION;
}
