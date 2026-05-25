"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const SLIDES = [
  "Connect your wallet. The agent reads your portfolio instantly.",
  "Pick a strategy — safe, balanced, maximum yield, or build your own.",
  "Deploy. Your agent runs 24/7. No babysitting needed.",
];

// Slides mulai setelah 5% dari scroll VSE
const SLIDES_START = 0.05;

export default function VideoExpandSection() {
  const outerRef   = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const slideRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const activeIdx  = useRef(-1);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const hero = document.querySelector("[data-hero-section]") as HTMLElement;
    if (!hero || !outerRef.current) return;

    const vhPx = window.innerHeight;

    gsap.set(overlayRef.current, { autoAlpha: 0 });
    SLIDES.forEach((_, i) => {
      gsap.set(slideRefs.current[i], { autoAlpha: 0 });
      gsap.set(textRefs.current[i], { yPercent: 110 });
    });

    const ctx = gsap.context(() => {
      // ── Expansion: mulai dari scrollY=0, selesai dalam 150px ──────────
      // trigger: document.body → start tepat di atas halaman
      ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "+=150",
        onUpdate: (self) => {
          const expandP = self.progress;
          const margin  = 14 * (1 - expandP);
          gsap.set(hero, {
            marginLeft:   margin,
            marginRight:  margin,
            marginTop:    margin,
            marginBottom: margin,
            borderRadius: 20 * (1 - expandP),
            height:       vhPx - 28 + 28 * expandP,
          });
        },
      });

      // ── Slides: dipicu saat VSE masuk viewport ────────────────────────
      ScrollTrigger.create({
        trigger: outerRef.current,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => {
          const p = self.progress;

          if (p < SLIDES_START) {
            if (activeIdx.current !== -1) {
              activeIdx.current = -1;
              gsap.to(overlayRef.current, { autoAlpha: 0, duration: 0.2, overwrite: true });
            }
            return;
          }

          if (activeIdx.current === -1) {
            gsap.to(overlayRef.current, { autoAlpha: 1, duration: 0.4, overwrite: true });
          }

          const slideP = (p - SLIDES_START) / (1 - SLIDES_START);
          const next   = Math.min(SLIDES.length - 1, Math.floor(slideP * SLIDES.length));

          if (next === activeIdx.current) return;

          const prev = activeIdx.current;
          activeIdx.current = next;

          if (counterRef.current) counterRef.current.textContent = `0${next + 1}`;

          if (prev >= 0) {
            const dir = next > prev ? -110 : 110;
            gsap.to(textRefs.current[prev],  { yPercent: dir, duration: 0.4, ease: "power3.in",  overwrite: true });
            gsap.to(slideRefs.current[prev], { autoAlpha: 0,  duration: 0.3, delay: 0.1, overwrite: true });
          }

          gsap.set(textRefs.current[next],  { yPercent: next > prev ? 110 : -110 });
          gsap.set(slideRefs.current[next], { autoAlpha: 1 });
          gsap.to(textRefs.current[next],   { yPercent: 0, duration: 0.7, ease: "power3.out", overwrite: true });
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    // 400vh — cukup untuk 3 slides (~127vh per slide)
    <div ref={outerRef} style={{ height: "400vh" }}>
      <div
        ref={overlayRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        {/* Counter */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "40px",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: "100px",
            padding: "8px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.72rem",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <span ref={counterRef}>01</span>
          <span style={{ opacity: 0.4 }}>/ 0{SLIDES.length}</span>
        </div>

        {/* Slides */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-10%, -50%)",
            width: "55%",
          }}
        >
          {SLIDES.map((text, i) => (
            <div
              key={i}
              ref={(el) => { slideRefs.current[i] = el; }}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", opacity: 0, visibility: "hidden" }}
            >
              <div style={{ overflow: "hidden", paddingBottom: "0.05em" }}>
                <div
                  ref={(el) => { textRefs.current[i] = el; }}
                  style={{
                    color: "#ffffff",
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(1.8rem, 3.8vw, 3.5rem)",
                    fontWeight: 400,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
