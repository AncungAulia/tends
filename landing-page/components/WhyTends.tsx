"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/* Feature bento: tall cards with the icon up top and label / title / subtitle
   anchored at the bottom. No header. Solid fills (no gradient) in three darker
   tones of the same brand-blue family so white ink stays high-contrast. No
   em-dashes in copy. On the first scroll into view, the headline, subtext, then
   each card blur-fade up one by one - it plays ONCE and stays put after, so
   scrolling back up does not replay it. */

const NAVY = "#0C1A2B";
const MUTED = "#5B7490";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

// Three darker brand blues (all from our palette: hero deep / bot / accordion),
// spread so no two neighbours match. Dark enough for white text to pop.
const BENTO = ["#16306E", "#1D4D91", "#2C5EAD", "#2C5EAD", "#16306E", "#1D4D91"];

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type Feature = { label: string; title: string; subtitle: string; icon: ReactNode };

const FEATURES: Feature[] = [
  {
    label: "Always on",
    title: "Runs 24/7",
    subtitle: "Watches the market and acts around the clock.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    label: "Self-custody",
    title: "Non-custodial",
    subtitle: "Your funds never leave your wallet.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <rect x="5" y="10.5" width="14" height="9" rx="2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        <circle cx="12" cy="15" r="1.3" />
      </svg>
    ),
  },
  {
    label: "Real yield",
    title: "RWA-backed",
    subtitle: "Backed by real assets, not emissions and hype.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <path d="M4 20h16" />
        <rect x="6" y="13" width="3" height="5" rx="0.8" />
        <rect x="10.5" y="9.5" width="3" height="8.5" rx="0.8" />
        <rect x="15" y="6" width="3" height="12" rx="0.8" />
      </svg>
    ),
  },
  {
    label: "Adaptive",
    title: "Rebalances daily",
    subtitle: "Shifts positions to keep your risk on target.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
  },
  {
    label: "On Mantle",
    title: "Fast and cheap",
    subtitle: "Low fees mean more of your yield stays yours.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" />
      </svg>
    ),
  },
  {
    label: "Effortless",
    title: "One-click deploy",
    subtitle: "Pick a strategy and you are done.",
    icon: (
      <svg viewBox="0 0 24 24" width="72" height="72" {...stroke}>
        <path d="M7 7l4.5 11 1.8-4.7L18 11.5 7 7Z" />
      </svg>
    ),
  },
];

export default function WhyTends() {
  const sectionRef = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduce(true);
      setShown(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    // Reveal ONCE: play the entry on the first scroll-down into view, then stop
    // observing so it never re-blurs when scrolling back up past it.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Blur + fade-up reveal, staggered by index so items appear one by one.
  const reveal = (i: number): React.CSSProperties => {
    if (reduce) return {};
    const delay = i * 0.1;
    return {
      opacity: shown ? 1 : 0,
      filter: shown ? "blur(0px)" : "blur(8px)",
      transform: shown ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.65s ease ${delay}s, filter 0.65s ease ${delay}s, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}s`,
      willChange: "opacity, filter, transform",
    };
  };

  return (
    <section
      ref={sectionRef}
      style={{
        background: "#F7F9FC",
        padding: "clamp(64px, 9vw, 120px) clamp(20px, 6vw, 96px)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Headline + subtext, pushed to the right above the bento */}
        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            marginBottom: "clamp(48px, 6vw, 84px)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: "clamp(2rem, 4vw, 3.2rem)",
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: NAVY,
              margin: 0,
              ...reveal(0),
            }}
          >
            Your capital, on autopilot.
          </h2>
          <p
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: "clamp(0.88rem, 1.1vw, 0.98rem)",
              lineHeight: 1.6,
              color: MUTED,
              margin: "18px auto 0",
              maxWidth: "50ch",
              ...reveal(1),
            }}
          >
            Each card below is a job your agent handles on its own. Together they
            keep your portfolio working while you do anything else.
          </p>
        </div>

        {/* Bento */}
        <div
          style={{
            display: "grid",
            // min(100%, 300px) keeps the track from forcing horizontal overflow
            // on phones narrower than 300px + padding (collapses to one column).
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f, i) => {
          const color = BENTO[i % BENTO.length];
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: 300,
                borderRadius: 20,
                padding: "28px 28px 30px",
                background: color,
                color: "#fff",
                boxShadow: "0 10px 28px rgba(20,40,70,0.12)",
                ...reveal(2 + i),
              }}
            >
              <div style={{ color: "#fff" }}>{f.icon}</div>

              <div style={{ flex: 1 }} />

              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 14,
                }}
              >
                {f.label}
              </div>
              <h3
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: "clamp(1.3rem, 2vw, 1.6rem)",
                  letterSpacing: "-0.01em",
                  color: "#fff",
                  margin: 0,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: "0.95rem",
                  lineHeight: 1.5,
                  color: "rgba(255,255,255,0.72)",
                  margin: "12px 0 0",
                }}
              >
                {f.subtitle}
              </p>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
