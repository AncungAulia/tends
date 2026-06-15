"use client";

import { useState } from "react";
import TendsBotFace, { type BotFaceVariant } from "./TendsBotFace";
import { useIsMobile } from "@/lib/useIsMobile";

// Text lifted from the Strategies section, paired with 4 different colors from
// the existing palette (royal → brand → sky → pale).
const STRATEGIES = [
  {
    label: "LOW",
    title: "Preserve and grow steadily.",
    description:
      "Stable yield strategies in top-tier liquid pools. Minimal volatility, consistent returns. Ideal for capital you can't afford to lose.",
    color: "#2C5EAD",
    dark: false,
  },
  {
    label: "MEDIUM",
    title: "Optimize for risk-adjusted yield.",
    description:
      "A diversified blend across lending protocols and LP positions. Your agent rebalances daily to capture yield spikes.",
    color: "#1591DC",
    dark: false,
  },
  {
    label: "HIGH",
    title: "Chase the highest yield.",
    description:
      "Rotates into high-APY vaults and emerging pools. Higher drawdowns, higher ceiling. Not for the faint-hearted.",
    color: "#4BB8FA",
    dark: false,
  },
  {
    label: "CUSTOM",
    title: "Build your own agent.",
    description:
      "Set your own protocol weights, risk parameters, and rebalancing frequency. Your strategy, executed by your agent.",
    color: "#EAF4FC",
    dark: true, // pale card → dark ink
  },
];

// Entrance choreography: each card slides in from the right, one by one.
const LEAD = 0.35; // wait for the bot to pop in first
const STAGGER = 0.2; // gap between cards

export default function StrategyAccordion({
  height = "min(80vh, 560px)",
  maxWidth = 720,
  show = true,
}: {
  height?: string;
  maxWidth?: number | string;
  /** Drives the slide-in (true) / slide-out (false) of the cards. */
  show?: boolean;
}) {
  // Hover-driven accordion. The whole stack lives in a FIXED-height box: the
  // hovered card grows (flex-grow) and the others shrink to their header, so
  // the total area never changes and the page never scrolls/shifts.
  const [hovered, setHovered] = useState<number | null>(null);
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        // Fixed total height — expansion is redistributed inside this box.
        height,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {STRATEGIES.map((s, i) => {
        const open = hovered === i;
        const ink = s.dark ? "#0C1A2B" : "#ffffff";
        const sub = s.dark ? "rgba(12,26,43,0.62)" : "rgba(255,255,255,0.74)";
        // LOW → MEDIUM → HIGH → CUSTOM maps 1:1 from the label.
        const variant = s.label.toLowerCase() as BotFaceVariant;
        // In: top-to-bottom after a lead. Out: reversed (bottom-to-top).
        const slideDelay = show
          ? LEAD + i * STAGGER
          : (STRATEGIES.length - 1 - i) * STAGGER;

        return (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            // Touch has no hover: on mobile a tap opens the card (and toggles it
            // shut). Desktop keeps pure hover so a click never collapses it.
            onClick={() => {
              if (isMobile) setHovered((h) => (h === i ? null : i));
            }}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 16,
              background: s.color,
              cursor: "default",
              // The whole layout is driven by flex-grow within the fixed box.
              flexGrow: open ? 4 : 1,
              flexBasis: 0,
              minHeight: 80, // fits the idle icon + label even when shrunk
              boxShadow: open
                ? "0 18px 44px rgba(20,40,70,0.24), inset 0 1px 0 rgba(255,255,255,0.18)"
                : "0 6px 18px rgba(20,40,70,0.10), inset 0 1px 0 rgba(255,255,255,0.14)",
              // Slide in/out from the right (staggered). flex-grow/box-shadow
              // keep a 0s delay so hover-expand stays instant.
              transform: show ? "translateX(0)" : "translateX(120%)",
              opacity: show ? 1 : 0,
              transition: `transform 0.6s cubic-bezier(0.16,1,0.3,1) ${slideDelay}s, opacity 0.45s ease ${slideDelay}s, flex-grow 0.45s cubic-bezier(0.4,0,0.2,1) 0s, box-shadow 0.3s ease 0s`,
            }}
          >
            {/* Soft diagonal sheen + a faint bottom grounding — gives the flat
                color fill a bit of dimension without reading as a gradient. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: s.dark
                  ? "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 46%), linear-gradient(0deg, rgba(8,18,32,0.05) 0%, rgba(8,18,32,0) 28%)"
                  : "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 44%), linear-gradient(0deg, rgba(8,18,32,0.12) 0%, rgba(8,18,32,0) 32%)",
              }}
            />

            {/* Shine sweep — a single light streak that crosses the card the
                moment it expands, then resets instantly when collapsed so it's
                primed for the next open. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "55%",
                pointerEvents: "none",
                background:
                  "linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 100%)",
                transform: open ? "translateX(320%)" : "translateX(-130%)",
                opacity: open ? 1 : 0,
                transition: open
                  ? "transform 0.9s cubic-bezier(0.22,1,0.36,1) 0.05s, opacity 0.25s ease"
                  : "none",
              }}
            />

            {/* Bot face chip — left. White rounded chip so the navy bot pops on
                every card colour. Anchored to the top when this card is open
                (it's the big animated logo of the expanded panel); otherwise
                vertically centered so the top/bottom gap stays even at ANY row
                height. The face only animates while open (active={open}). */}
            <div
              style={{
                position: "absolute",
                left: 22,
                top: open ? 16 : "50%",
                transform: open ? "translateY(0)" : "translateY(-50%)",
                width: open ? 150 : 60,
                height: open ? 150 : 60,
                borderRadius: open ? 16 : 12,
                background: "#ffffff",
                boxShadow: "0 2px 12px rgba(20,40,70,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: open ? 16 : 7,
                overflow: "visible",
                transition:
                  "width 0.45s cubic-bezier(0.4,0,0.2,1), height 0.45s cubic-bezier(0.4,0,0.2,1), border-radius 0.3s ease, padding 0.45s cubic-bezier(0.4,0,0.2,1), top 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <TendsBotFace variant={variant} active={open} />
            </div>

            {/* Number + risk label — right side, stacked as one group.
                Anchored to the top when open; otherwise vertically centered as a
                group so the gap stays even (mirrors the icon). The label is BIG
                while idle (nothing expanded) or when this IS the open card, and
                shrinks to the compact size only when a sibling expansion has
                stolen the room. */}
            <div
              style={{
                position: "absolute",
                right: 22,
                top: open ? 14 : "50%",
                transform: open ? "translateY(0)" : "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
                transition:
                  "top 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: ink,
                  opacity: 0.85,
                }}
              >
                0{i + 1}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans, sans-serif)",
                  fontSize:
                    open || hovered === null
                      ? "clamp(1.5rem, 2.4vw, 2.2rem)"
                      : "clamp(1.05rem, 1.6vw, 1.5rem)",
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                  color: ink,
                  transition: "font-size 0.35s cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {s.label}
              </span>
            </div>

            {/* Footer — pinned to the bottom, fades in once the card grows.
                Absolutely positioned so it never affects the flex sizing. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "0 22px 22px",
                pointerEvents: "none",
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
                transitionDelay: open ? "0.08s" : "0s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  // On phones the side-by-side 56/42 split is too cramped, so the
                  // title + description stack and use the full card width.
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: isMobile ? "flex-start" : "flex-end",
                  justifyContent: "space-between",
                  gap: isMobile ? 8 : 24,
                }}
              >
                {/* Main Text (title) — bottom-left */}
                <h3
                  style={{
                    margin: 0,
                    maxWidth: isMobile ? "100%" : "56%",
                    fontFamily: "var(--font-sans, sans-serif)",
                    fontSize: "clamp(1.25rem, 2.2vw, 1.6rem)",
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    color: ink,
                  }}
                >
                  {s.title}
                </h3>

                {/* Subtext (description) — bottom-right */}
                <p
                  style={{
                    margin: 0,
                    maxWidth: isMobile ? "100%" : "42%",
                    fontFamily: "var(--font-sans, sans-serif)",
                    fontSize: "0.82rem",
                    lineHeight: 1.55,
                    color: sub,
                    textAlign: isMobile ? "left" : "right",
                  }}
                >
                  {s.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
