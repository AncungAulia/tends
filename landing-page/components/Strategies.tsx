"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsMobile } from "@/lib/useIsMobile";

const strategies = [
  {
    title: "Preserve and grow steadily.",
    description:
      "Stable yield strategies in top-tier liquid pools. Minimal volatility, consistent returns. Ideal for capital you can't afford to lose.",
    color: "#2C5EAD",
  },
  {
    title: "Optimize for risk-adjusted yield.",
    description:
      "A diversified blend across lending protocols and LP positions. Your agent rebalances daily to capture yield spikes.",
    color: "#1591DC",
  },
  {
    title: "Chase the highest yield.",
    description:
      "Rotates into high-APY vaults and emerging pools. Higher drawdowns, higher ceiling. Not for the faint-hearted.",
    color: "#4BB8FA",
  },
  {
    title: "Build your own agent.",
    description:
      "Set your own protocol weights, risk parameters, and rebalancing frequency. Your strategy, executed by your agent.",
    color: "#EAF4FC",
  },
];

const STICKY_TOP = 80; // px — clears navbar
const STICKY_GAP = 32; // px — bottom breathing room

export default function Strategies() {
  const isMobile = useIsMobile();
  const sectionRef   = useRef<HTMLElement>(null);
  const introRef     = useRef<HTMLDivElement>(null); // 90vh wrapper — scroll trigger
  const introTextRef = useRef<HTMLDivElement>(null); // teks yang di-pin
  const outerRef     = useRef<HTMLDivElement>(null); // 400vh scroll range tabs
  const textEls      = useRef<(HTMLDivElement | null)[]>([]);  // text slides (RIGHT panel)
  const colorEls     = useRef<(HTMLDivElement | null)[]>([]);  // color panels (LEFT panel)
  const dotsRef      = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const texts  = textEls.current.filter(Boolean)  as HTMLDivElement[];
      const colors = colorEls.current.filter(Boolean) as HTMLDivElement[];
      const dots   = dotsRef.current.filter(Boolean)  as HTMLDivElement[];

      /* ── 1. PIN intro text ────────────────────────────────────────── */
      ScrollTrigger.create({
        trigger: introRef.current,
        start: "top top",
        end: "bottom top",
        pin: introTextRef.current,
        pinSpacing: false,
      });

      /* ── 2. Initial states ────────────────────────────────────────── */
      texts.forEach((el, i)  => gsap.set(el, { yPercent: i === 0 ? 0 : 100 }));
      colors.forEach((el, i) => gsap.set(el, { yPercent: i === 0 ? 0 : 100, zIndex: 0 }));
      if (colors[0]) gsap.set(colors[0], { zIndex: 1 });
      dots.forEach((d, i) => {
        d.style.background = i === 0 ? "#ffffff" : "rgba(255,255,255,0.35)";
      });

      /* ── 3. ScrollTrigger tabs switching ──────────────────────────── */
      let current = 0;

      ScrollTrigger.create({
        trigger: outerRef.current,
        start: `top top+=${STICKY_TOP}`,
        end: () => `+=${(strategies.length - 1) * window.innerHeight}`,
        scrub: false,
        onUpdate: (self) => {
          const index = Math.min(
            Math.floor(self.progress * strategies.length),
            strategies.length - 1,
          );
          if (index === current) return;
          const prev = current;
          current = index;

          const dir = index > prev ? 1 : -1;

          /* text slides — slide up/down */
          gsap.set(texts[index], { yPercent: dir * 100 });
          gsap.to(texts[prev],   { yPercent: -dir * 100, duration: 0.5, ease: "power2.inOut", overwrite: true });
          gsap.to(texts[index],  { yPercent: 0,           duration: 0.5, ease: "power2.inOut", overwrite: true });

          /* color panels — incoming from below, outgoing to below */
          gsap.set(colors[index], { zIndex: 2, yPercent: 100 });
          gsap.set(colors[prev],  { zIndex: 1 });

          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(colors[index], { zIndex: 1 });
              gsap.set(colors[prev],  { zIndex: 0 });
            },
          });
          tl.to(colors[prev],  { yPercent: 100, duration: 0.55, ease: "power2.inOut" }, 0)
            .to(colors[index], { yPercent: 0,   duration: 0.55, ease: "power2.inOut" }, 0);

          /* dots */
          dots.forEach((d, i) => {
            d.style.background = i === index ? "#ffffff" : "rgba(255,255,255,0.35)";
          });
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} style={{ background: "#F0F4F8" }}>
      {/* ── INTRO WRAPPER — 90vh ────────────────────────────────────────
          Teks di-pin di sini. Tabs section slide naik menutupinya.   */}
      <div
        ref={introRef}
        style={{
          height: "90vh",
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          position: "relative",
          justifyContent: "center",
        }}
      >
        <div ref={introTextRef} style={{ padding: isMobile ? "0 20px" : "0 70px" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: "clamp(3rem, 5.5vw, 5rem)",
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              color: "#0C1A2B",
              margin: 0,
              textAlign: "center",
            }}
          >
            Choose Your Agent
          </h2>
        </div>
      </div>

      {/* ── TABS SECTION — slide naik menutupi intro ────────────────────
          JANGAN overflow:hidden di sini — akan break position:sticky!  */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          borderRadius: "28px 28px 0 0",
          background: "#F7F9FC",
        }}
      >
        <div ref={outerRef} style={{ height: `${strategies.length * 100}vh` }}>
          <div
            style={{
              position: "sticky",
              top: `${STICKY_TOP}px`,
              height: `calc(100vh - ${STICKY_TOP + STICKY_GAP}px)`,
              padding: isMobile ? "16px 16px" : "50px 70px",
            }}
          >
            {/* ── OUTER CARD: video bg, no overlay ────────────────────── */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",   // safe here — ini bukan sticky parent
                borderRadius: "20px",
                height: "110%",
              }}
            >
              {/* Video background — fills entire outer card */}
              <video
                autoPlay
                muted
                loop
                playsInline
                src="/video/video1.mp4"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />

              {/* ── INNER WRAPPER: padding + grid 2 panels ──────────────
                  Video terlihat di gap & tepi. Padding ciptakan breathing room. */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  height: "100%",
                  padding: isMobile ? "12px" : "24px",
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr",
                  gap: "12px",
                }}
              >
              {/* ── LEFT — animated color panels
                  Mobile: absolute overlay covering entire card (Option B)
                  Desktop: left column (1.5fr)                            */}
              <div
                style={isMobile ? {
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  borderRadius: "20px",
                  zIndex: 0,
                } : {
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "10px",
                }}
              >
                {strategies.map((s, i) => (
                  <div
                    key={i}
                    ref={(el) => { colorEls.current[i] = el; }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: s.color,
                    }}
                  />
                ))}
              </div>

              {/* ── RIGHT — text panel
                  Mobile: full width, z-index above color overlay
                  Desktop: right column (1fr), transparent bg           */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: isMobile ? "20px 24px" : "28px 36px",
                  zIndex: isMobile ? 1 : "auto",
                }}
              >
                {/* text slides — overflow:hidden clips yPercent animation */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                  {strategies.map((s, i) => (
                    <div
                      key={i}
                      ref={(el) => { textEls.current[i] = el; }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "12px 0",
                      }}
                    >
                      <h3
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 700,
                          fontSize: "clamp(1.6rem, 2.4vw, 2.4rem)",
                          lineHeight: 1.5,
                          color: "#ffffff",
                          marginBottom: "20px",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {s.title}
                      </h3>
                      <p
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "clamp(0.82rem, 1vw, 0.92rem)",
                          lineHeight: 1.7,
                          color: "rgba(255, 255, 255, 0.55)",
                        }}
                      >
                        {s.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* dot nav */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    paddingTop: "8px",
                  }}
                >
                  {strategies.map((_, i) => (
                    <div
                      key={i}
                      ref={(el) => { dotsRef.current[i] = el; }}
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.35)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  ))}
                </div>
              </div>
              </div> {/* ── /INNER WRAPPER */}
            </div> {/* ── /OUTER CARD */}
          </div> {/* ── /sticky */}
        </div> {/* ── /outerRef */}
      </div> {/* ── /TABS SECTION */}
    </section>
  );
}
