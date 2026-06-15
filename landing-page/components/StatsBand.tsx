"use client";

import LineWaves from "./LineWaves";
import { useIsMobile } from "@/lib/useIsMobile";

/* Trust band. Same blue as the hero (gradient + LineWaves shader + contrast
   overlay), inset by the hero's own frame size so a thin white border shows on
   every edge. The shader is DESKTOP-ONLY: on mobile a second WebGL canvas next
   to the hero's is too heavy (GPU/battery), so phones get the static gradient,
   which still reads as the hero blue. Figures illustrative; swap with live data. */

const STATS: { value: string; label: string }[] = [
  { value: "6+", label: "Protocols integrated" },
  { value: "Up to 12%", label: "Target APY" },
  { value: "24/7", label: "Autonomous monitoring" },
  { value: "100%", label: "Non-custodial" },
];

export default function StatsBand() {
  const isMobile = useIsMobile();

  return (
    <section
      style={{
        background: "#F7F9FC",
        // Same frame as the hero: 14px desktop, 8px mobile.
        padding: isMobile ? "8px" : "14px",
      }}
    >
      <div
        data-blue-section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          background:
            "linear-gradient(135deg, #1B6A85 0%, #1F4FA0 45%, #16306E 100%)",
        }}
      >
        {/* Animated shader — desktop only. */}
        {!isMobile && (
          <div style={{ position: "absolute", inset: 0 }}>
            <LineWaves
              speed={0.35}
              innerLineCount={21}
              outerLineCount={36}
              warpIntensity={1.4}
              rotation={20}
              edgeFadeWidth={0}
              colorCycleSpeed={1.6}
              brightness={0.18}
              color1="#2E6FB5"
              color2="#3A88B8"
              color3="#4A9EBF"
              enableMouseInteraction
              mouseInfluence={1.8}
            />
          </div>
        )}

        {/* Contrast overlay so the white numbers stay legible. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(160deg, rgba(12,26,43,0.32) 0%, rgba(12,26,43,0.10) 55%, rgba(12,26,43,0.28) 100%)",
          }}
        />

        {/* Stats — a centered group inside the wide band. */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            // Items size to their content, so the long "Up to 12%" is never
            // clipped; the wide column-gap is the spacing between them.
            columnGap: "clamp(40px, 5vw, 90px)",
            rowGap: "clamp(32px, 5vw, 48px)",
            padding: "clamp(52px, 7vw, 92px) clamp(24px, 5vw, 56px)",
          }}
        >
          {STATS.map((s, i) => (
            <div key={i} style={{ flexShrink: 0, textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 700,
                  fontSize: "clamp(2.2rem, 4.6vw, 3.4rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  whiteSpace: "nowrap",
                  color: "#ffffff",
                  // Subtle blue sheen on the numbers.
                  background: "linear-gradient(180deg, #ffffff 0%, #BFE0F7 140%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.74rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  marginTop: 14,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
