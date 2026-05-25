"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
  const sectionRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null); // 90vh wrapper — scroll trigger
  const introTextRef = useRef<HTMLDivElement>(null); // teks yang di-pin
  const outerRef = useRef<HTMLDivElement>(null); // 400vh scroll range tabs
  const leftEls = useRef<(HTMLDivElement | null)[]>([]);
  const rightEls = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // scope ke sectionRef biar semua refs (intro + tabs) ikut di-cleanup
    const ctx = gsap.context(() => {
      const lefts = leftEls.current.filter(Boolean) as HTMLDivElement[];
      const rights = rightEls.current.filter(Boolean) as HTMLDivElement[];
      const dots = dotsRef.current.filter(Boolean) as HTMLDivElement[];

      /* ── 1. PIN intro text ────────────────────────────────────────
         Teks "Pick your strategy." terpaku di tempat saat
         tabs section slide naik menutupinya dari bawah.           */
      ScrollTrigger.create({
        trigger: introRef.current,
        start: "top top",
        end: "bottom top",
        pin: introTextRef.current,
        pinSpacing: false,
      });

      /* ── 2. Initial states untuk tabs ────────────────────────── */
      lefts.forEach((el, i) =>
        gsap.set(el, { yPercent: i === 0 ? 0 : 100 }),
      );
      rights.forEach((el, i) =>
        gsap.set(el, { yPercent: i === 0 ? 0 : 100, zIndex: 0 }),
      );
      if (rights[0]) gsap.set(rights[0], { zIndex: 1 });
      dots.forEach((d, i) => {
        d.style.background = i === 0 ? "#0C1A2B" : "#DDE8F2";
      });

      /* ── 3. ScrollTrigger tabs switching ─────────────────────── */
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

          /* left text — slide up/down, arah sesuai scroll */
          const dir = index > prev ? 1 : -1; // 1 = maju, -1 = mundur
          gsap.set(lefts[index], { yPercent: dir * 100 });
          gsap.to(lefts[prev],  { yPercent: -dir * 100, duration: 0.5, ease: "power2.inOut", overwrite: true });
          gsap.to(lefts[index], { yPercent: 0,          duration: 0.5, ease: "power2.inOut", overwrite: true });

          /* right panels — incoming naik dari bawah, outgoing turun ke bawah */
          gsap.set(rights[index], { zIndex: 2, yPercent: 100 });
          gsap.set(rights[prev], { zIndex: 1 });

          const tl = gsap.timeline({
            onComplete: () => {
              gsap.set(rights[index], { zIndex: 1 });
              gsap.set(rights[prev], { zIndex: 0 });
            },
          });
          tl.to(
            rights[prev],
            { yPercent: 100, duration: 0.55, ease: "power2.inOut" },
            0,
          ).to(
            rights[index],
            { yPercent: 0, duration: 0.55, ease: "power2.inOut" },
            0,
          );

          /* dots */
          dots.forEach((d, i) => {
            d.style.background = i === index ? "#0C1A2B" : "#DDE8F2";
          });
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} style={{ background: "#F0F4F8" }}>
      {/* ── INTRO WRAPPER — 90vh, latar abu muda ────────────────────
          Teks di-pin di sini. Tabs section slide naik menutupinya. */}
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
        <div ref={introTextRef} style={{ padding: "0 70px" }}>
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

      {/* ── TABS SECTION — slide naik menutupi intro ────────────────
          position: relative + zIndex lebih tinggi dari intro.
          borderRadius di atas biar keliatan efek "kartu slide naik".
          JANGAN overflow: hidden — akan break position: sticky!     */}
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
              display: "grid",
              gridTemplateColumns: "0.4fr 1fr",
              gap: "16px",
              padding: "50px 70px",
            }}
          >
            {/* ── LEFT — video card ─────────────────────────────────── */}
            <div
              style={{
                borderRadius: "20px",
                background: "#0C1A2B",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "28px",
              }}
            >
              {/* video background */}
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
                  opacity: 0.55,
                }}
              />
              {/* dark overlay biar teks terbaca */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(12,26,43,0.85) 40%, rgba(12,26,43,0.3) 100%)",
                  zIndex: 1,
                }}
              />

              {/* content layers */}
              <div style={{ flex: 1, position: "relative", zIndex: 2 }}>
                {strategies.map((s, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      leftEls.current[i] = el;
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-around",
                      // pointerEvents: "none",
                      padding: "12px 0",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontWeight: 700,
                          fontSize: "clamp(1.6rem, 2.4vw, 2.4rem)",
                          lineHeight: 1.5,
                          color: "white",
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
                          color: "rgba(255, 255, 255, 0.4)",
                        }}
                      >
                        {s.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* dot nav */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  paddingTop: "8px",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {strategies.map((_, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      dotsRef.current[i] = el;
                    }}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#DDE8F2",
                      transition: "background 0.3s ease",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ── RIGHT — 4 panel warna, slide up on switch ─────────── */}
            <div
              style={{
                borderRadius: "20px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {strategies.map((s, i) => (
                <div
                  key={i}
                  ref={(el) => {
                    rightEls.current[i] = el;
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: s.color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
