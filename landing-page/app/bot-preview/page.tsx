"use client";

import { useState } from "react";
import BotPrism, {
  type BotVariant,
  type MorphMode,
} from "@/components/BotPrism";

const VARIANTS: { key: BotVariant; label: string }[] = [
  { key: "matte", label: "Matte" },
  { key: "gradient", label: "Gradient" },
  { key: "toon", label: "Toon (cartoon)" },
  { key: "glossy", label: "Glossy" },
];

const MODES: { key: MorphMode; label: string }[] = [
  { key: "lean", label: "Lean (condong)" },
  { key: "bend", label: "Bend (membungkuk)" },
];

// Standalone preview: switch skins live and watch the cursor-reactive motion
// (head turn + pupil glance + float) before wiring it into the real section.
export default function BotPreviewPage() {
  const [variant, setVariant] = useState<BotVariant>("glossy");
  const [morphMode, setMorphMode] = useState<MorphMode>("lean");

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(180deg, #dbe8f5 0%, #f2f6fb 100%)",
      }}
    >
      {/* Skin switcher */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,0.7)",
          padding: 6,
          borderRadius: 999,
          backdropFilter: "blur(6px)",
          boxShadow: "0 4px 20px rgba(20,40,70,0.12)",
        }}
      >
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            onClick={() => setVariant(v.key)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "8px 16px",
              borderRadius: 999,
              fontFamily: "var(--font-sans, sans-serif)",
              fontSize: 13,
              fontWeight: 600,
              color: variant === v.key ? "#ffffff" : "#1c3a63",
              background: variant === v.key ? "#1591DC" : "transparent",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Morph-mode switcher */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,0.7)",
          padding: 6,
          borderRadius: 999,
          backdropFilter: "blur(6px)",
          boxShadow: "0 4px 20px rgba(20,40,70,0.12)",
        }}
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMorphMode(m.key)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "8px 16px",
              borderRadius: 999,
              fontFamily: "var(--font-sans, sans-serif)",
              fontSize: 13,
              fontWeight: 600,
              color: morphMode === m.key ? "#ffffff" : "#1c3a63",
              background: morphMode === m.key ? "#0C1A2B" : "transparent",
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <BotPrism
        variant={variant}
        morphMode={morphMode}
        style={{ position: "absolute", inset: 0 }}
      />

      <p
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          margin: 0,
          fontFamily: "var(--font-sans, sans-serif)",
          fontSize: 12,
          color: "#5b7490",
        }}
      >
        Gerakkan kursor — kepala menoleh & mata melirik. Berkedip tiap 5 detik.
      </p>
    </main>
  );
}
