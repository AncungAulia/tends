"use client";

import { useState, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { DEFAULT_DESIGN, frontSrc, backSrc } from "@/lib/cardDesigns";

export type VaultRisk = "Low" | "Medium" | "High";

const RISK_BADGE: Record<VaultRisk, string> = {
  Low: "bg-green-400/25 text-green-100",
  Medium: "bg-yellow-400/25 text-yellow-100",
  High: "bg-red-400/25 text-red-100",
};
const SPRING = { stiffness: 250, damping: 18 };
const FLIP_SPRING = { type: "spring" as const, stiffness: 200, damping: 22 };

function Face({
  children,
  className = "",
  image,
}: {
  children: React.ReactNode;
  className?: string;
  image?: string;
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-2xl text-white shadow-xl shadow-black/25 [backface-visibility:hidden] ${className}`}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      )}
      <div className="relative h-full w-full p-5 sm:p-6">{children}</div>
    </div>
  );
}

export default function VaultCard({
  name,
  risk,
  balance,
  address = "0x3f4a •••• •••• c82b",
  design = DEFAULT_DESIGN,
  fill = false,
  back,
}: {
  name: string;
  risk: VaultRisk;
  balance?: number;
  address?: string;
  design?: string;
  fill?: boolean;
  back?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const flippable = !!back;

  const px = useMotionValue(0);
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
      className={`w-full ${fill ? "h-full min-h-64" : "aspect-[1.425/1]"}`}
    >
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={flippable ? () => setFlipped((f) => !f) : undefined}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`relative h-full w-full ${flippable ? "cursor-pointer" : ""}`}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={FLIP_SPRING}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-full w-full"
        >
          {/* FRONT — texture art (logo/chip/sunburst baked) + dynamic overlay */}
          <Face image={frontSrc(design)}>
            {/* legibility scrim, strongest at the bottom where text lives */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
            <div className="relative flex h-full flex-col justify-between">
              {/* top-right: risk badge (logo is baked top-left) */}
              <div className="flex justify-end">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.625rem] font-semibold backdrop-blur ${RISK_BADGE[risk]}`}
                >
                  {risk}
                </span>
              </div>

              {/* middle-left: balance */}
              <div>
                <p className="text-[0.625rem] uppercase tracking-[0.12em] text-white/55">
                  Total value
                </p>
                {balance != null ? (
                  <p className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                    $
                    {balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                ) : (
                  <p className="text-2xl font-semibold tracking-[-0.02em] text-white/70 sm:text-3xl">
                    —
                  </p>
                )}
              </div>

              {/* bottom-left: address + holder (kept clear of the baked emblem) */}
              <div className="max-w-[74%]">
                <p className="mb-2 font-mono text-[0.8125rem] tracking-[0.16em] text-white/90 sm:text-sm">
                  {address}
                </p>
                <div className="flex items-end gap-6">
                  <div>
                    <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-white/50">
                      Vault holder
                    </p>
                    <p className="text-sm font-medium">{name || "You"}</p>
                  </div>

                </div>
              </div>
            </div>
          </Face>

          {/* BACK — magstripe art + caller-supplied details */}
          {flippable && (
            <Face image={backSrc(design)} className="[transform:rotateY(180deg)]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20" />
              <div className="relative h-full">{back}</div>
            </Face>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
