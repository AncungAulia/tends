"use client";

import { useState, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

/* ──────────────────────────────────────────────────────────
   VaultCard — the user's vault, shown like a premium card.
   Hover = 3D tilt (outer, cursor-driven). If `back` is given,
   click flips it (inner, state-driven) to reveal the back.
   ────────────────────────────────────────────────────────── */

export type VaultRisk = "Low" | "Medium" | "High";

const RISK_BADGE: Record<VaultRisk, string> = {
  Low: "bg-green-400/20 text-green-300",
  Medium: "bg-yellow-400/20 text-yellow-300",
  High: "bg-red-400/20 text-red-300",
};
const RISK_GLOW: Record<VaultRisk, string> = {
  Low: "bg-green-400",
  Medium: "bg-yellow-400",
  High: "bg-red-400",
};
const SPRING = { stiffness: 250, damping: 18 };
const FLIP_SPRING = { type: "spring" as const, stiffness: 200, damping: 22 };

function Face({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-2xl p-5 text-white shadow-xl shadow-[#1591DC]/25 [backface-visibility:hidden] ${className}`}
    >
      {children}
    </div>
  );
}

export default function VaultCard({
  name,
  risk,
  balance,
  address = "0x3f4a •••• •••• c82b",
  fill = false,
  back,
}: {
  name: string;
  risk: VaultRisk;
  balance?: number;
  address?: string;
  fill?: boolean;
  back?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const flippable = !!back;

  // tilt — cursor-driven motion values
  const px = useMotionValue(0); // -0.5 .. 0.5 across the card
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), SPRING);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-8, 8]), SPRING);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      style={{ perspective: 1100 }}
      className={`w-full ${fill ? "h-full min-h-64" : "aspect-[1.6/1]"}`}
    >
      {/* outer — cursor tilt */}
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={flippable ? () => setFlipped((f) => !f) : undefined}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`relative h-full w-full ${flippable ? "cursor-pointer" : ""}`}
      >
        {/* inner — click flip */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={FLIP_SPRING}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-full w-full"
        >
          {/* FRONT */}
          <Face className="bg-gradient-to-br from-[#1591DC] to-[#0C1A2B]">
            <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
            <div
              className={`absolute -bottom-8 right-4 h-24 w-24 rounded-full opacity-40 blur-2xl ${RISK_GLOW[risk]}`}
            />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <img
                  src="/icon/tends-white.svg"
                  alt="Tends"
                  className="h-5 w-auto"
                />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.625rem] font-semibold backdrop-blur ${RISK_BADGE[risk]}`}
                >
                  {risk}
                </span>
              </div>

              {balance != null ? (
                <div>
                  <p className="text-[0.625rem] uppercase tracking-[0.12em] text-white/50">
                    Total value
                  </p>
                  <p className="text-3xl font-semibold tracking-[-0.02em]">
                    $
                    {balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ) : (
                <div className="h-7 w-10 rounded-md bg-gradient-to-br from-white/55 to-white/15" />
              )}

              <div>
                <p className="mb-2.5 font-mono text-sm tracking-[0.18em] text-white/85">
                  {address}
                </p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-white/50">
                      Vault holder
                    </p>
                    <p className="text-sm font-medium">{name || "You"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-white/50">
                      Network
                    </p>
                    <p className="text-sm font-medium">Mantle</p>
                  </div>
                </div>
              </div>
            </div>
          </Face>

          {/* BACK */}
          {flippable && (
            <Face className="bg-gradient-to-br from-[#0C1A2B] to-[#2C5EAD] [transform:rotateY(180deg)]">
              {back}
            </Face>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
