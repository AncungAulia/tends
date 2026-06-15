"use client";
import { useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";

const VIDEO_SRC = "/video/video2.mp4";

const navLinks = [
  { label: "Strategies", href: "/strategies" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Chat", href: "/chat" },
  { label: "Docs", href: "/docs" },
];

const socials = [
  { label: "X", href: "#" },
  { label: "In", href: "#" },
  { label: "Gh", href: "#" },
];

const BRAND_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  fontSize: "clamp(5rem, 18vw, 16rem)",
  letterSpacing: "-0.04em",
  lineHeight: 0.85,
  display: "block",
};

export default function Footer() {
  const [spot, setSpot] = useState({ x: 0, y: 0 });
  const [lit, setLit] = useState(false);
  const isMobile = useIsMobile();

  return (
    <footer
      style={{
        background: "#0C1A2B",
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Video background ─────────────────────────────────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        src={VIDEO_SRC}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
          opacity: 1,
        }}
      />
      {/* ── Dark overlay ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#0C1A2B",
          opacity: 0.6,
          zIndex: 0,
        }}
      />

      {/* ── Content wrapper (above video) ────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {/* ── Main content ─────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "40px",
            padding: isMobile ? "40px 20px 20px" : "60px 70px",
          }}
        >
          {/* Left — tagline + CTA */}
          <div style={{ maxWidth: "420px", paddingTop: "40px" }}>
            {/* <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(0.8rem, 1vw, 0.95rem)",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "20px",
            }}
          >
            Tends.
          </p> */}
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "clamp(1rem, 1.4vw, 1.2rem)",
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.6,
                marginBottom: "40px",
                paddingTop:"40px"
              }}
            >
              An AI-managed yield aggregator on Mantle Network. Your agent works
              24/7 so you don't have to.
            </p>
          </div>

          {/* Right — nav links */}
          <nav
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
            }}
          >
            {/* {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: "clamp(1.4rem, 2.4vw, 2rem)",
                letterSpacing: "-0.02em",
                color: "rgba(255,255,255,0.25)",
                textDecoration: "none",
                transition: "color 0.2s ease",
                lineHeight: 1.2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
            >
              {l.label}
            </a>
          ))} */}
          </nav>
        </div>

        {/* ── Spacer ────────────────────────────────────────────────── */}
        <div style={{ flex: 1 }} />

        {/* ── Social + tagline row ──────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "16px" : undefined,
            padding: isMobile ? "0 20px 32px" : "0 70px 48px",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.05em",
                  color: "rgba(255,255,255,0.4)",
                  textDecoration: "none",
                  transition: "border-color 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)";
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                }}
              >
                {s.label}
              </a>
            ))}
          </div>

          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.5)",
              textAlign: "right",
            }}
          >
            AI-managed RWA portfolios on Mantle.
          </p>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div
          style={{
            height: "1px",
            background: "rgba(255,255,255,0.08)",
            margin: isMobile ? "0 20px" : "0 70px",
          }}
        />

        {/* ── Bottom bar ───────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "16px 20px 24px" : "24px 70px 32px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            © 2026 Tends
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Built on Mantle
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            All rights reserved
          </p>
        </div>

        {/* ── Large brand name with spotlight effect ────────────────── */}
        <div
          style={{
            padding: isMobile ? "0 20px" : "0 60px",
            userSelect: "none",
            position: "relative",
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseEnter={() => setLit(true)}
          onMouseLeave={() => setLit(false)}
        >
          {/* Base dim layer */}
          <span style={{ ...BRAND_STYLE, color: "rgba(255,255,255,0.06)" }}>
            Tends.
          </span>

          {/* Bright spotlight layer — revealed by mask */}
          <span
            aria-hidden
            style={{
              ...BRAND_STYLE,
              position: "absolute",
              inset: 0,
              padding: isMobile ? "0 20px" : "0 60px",
              color: "#ffffff",
              opacity: lit ? 1 : 0,
              transition: "opacity 0.3s ease",
              WebkitMaskImage: `radial-gradient(circle 260px at ${spot.x}px ${spot.y}px, black 0%, transparent 100%)`,
              maskImage: `radial-gradient(circle 260px at ${spot.x}px ${spot.y}px, black 0%, transparent 100%)`,
            }}
          >
            Tends.
          </span>
        </div>
      </div>
      {/* end content wrapper */}
    </footer>
  );
}
