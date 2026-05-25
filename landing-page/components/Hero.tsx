"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const VIDEO_SRC1 = "/video/video1.mp4";

const VIDEO_SRC2 = "/video/video2.mp4";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const btnsRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Initial states — GSAP owns all transforms, tidak ada inline transform di JSX
    gsap.set(sectionRef.current, {
      scale: 0.08,
      borderRadius: "50%",
      transformOrigin: "center center",
      autoAlpha: 0,
    });
    gsap.set(overlayRef.current, { autoAlpha: 1 });
    gsap.set([line1Ref.current, line2Ref.current], { yPercent: 110 });
    gsap.set([subRef.current, btnsRef.current], { autoAlpha: 0, y: 20 });

    tl
      // Overlay fade + zoom mulai bersamaan
      .to(
        overlayRef.current,
        { autoAlpha: 0, duration: 0.5, ease: "power2.in" },
        0,
      )
      .to(
        sectionRef.current,
        {
          scale: 1,
          borderRadius: "20px",
          autoAlpha: 1,
          duration: 1.9,
          ease: "power3.inOut",
        },
        0.05,
      )
      // Semua reveal SETELAH zoom selesai (">" = after previous ends)
      .to(line1Ref.current, { yPercent: 0, duration: 1.0 }, ">")
      .to(line2Ref.current, { yPercent: 0, duration: 1.0 }, "<0.15")
      .to(subRef.current, { autoAlpha: 1, y: 0, duration: 0.8 }, ">-0.3")
      .to(btnsRef.current, { autoAlpha: 1, y: 0, duration: 0.8 }, "<0.1");

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <>
      {/* Full-screen white overlay — sibling of section so it's unaffected by section's transform */}
      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          inset: 0,
          background: "#ffffff",
          zIndex: 100,
          pointerEvents: "none",
        }}
      />

      <section
        ref={sectionRef}
        data-hero-section
        className="relative overflow-hidden"
        style={{
          marginLeft: "14px",
          marginRight: "14px",
          marginTop: "14px",
          marginBottom: "14px",
          height: "calc(100vh - 28px)",
          position: "sticky",
          top: 0,
        }}
      >
        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          src={VIDEO_SRC2}
        />

        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(12,26,43,0.62) 0%, rgba(12,26,43,0.38) 60%, rgba(12,26,43,0.55) 100%)",
          }}
        />

        {/* Content */}
        <div
          data-hero-content
          className="relative z-10 h-full flex flex-col pt-10 pb-12"
          style={{ paddingLeft: "30px", paddingRight: "30px" }}
        >
          {/* Headline */}
          <div className="flex-1 flex flex-col justify-center pt-12">
            <h1
              className="font-sans font-normal text-white leading-[0.93] tracking-[-0.03em]"
              style={{ fontSize: "clamp(4rem, 9.5vw, 7rem)" }}
            >
              <div className="clip-line">
                <div ref={line1Ref}>Fire your analyst,</div>
              </div>
              <div className="clip-line">
                <div ref={line2Ref} style={{ color: "#4BB8FA" }}>
                  deploy your agent.
                </div>
              </div>
            </h1>
          </div>

          {/* Bottom row */}
          <div
            className="flex items-end justify-between gap-8 pt-8"
            style={{ paddingBottom: "28px" }}
          >
            <div ref={subRef}>
              <p
                className="font-sans leading-relaxed text-white"
                style={{
                  fontSize: "clamp(1rem, 1.5vw, 1.5rem)",
                  maxWidth: "38ch",
                }}
              >
                AI-managed RWA portfolios on Mantle.
              </p>
            </div>

            <div
              ref={btnsRef}
              className="flex items-center gap-3 flex-shrink-0"
            >
              {/* Pill 1 — text */}
              <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  background: hovered ? "#4BB8FA" : "#0C1A2B",
                  color: hovered ? "#0C1A2B" : "#ffffff",
                  padding: "14px 22px",
                  borderRadius: "12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  transition: "background 0.4s ease, color 0.4s ease",
                  display: "flex",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Deploy Agent
              </div>

              {/* Pill 2 — arrow */}
              <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                  background: hovered ? "#0C1A2B" : "#4BB8FA",
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  position: "relative",
                  overflow: "hidden",
                  transition: "background 0.4s ease",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: hovered ? "translateX(100%)" : "translateX(0)",
                    transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      stroke={hovered ? "#ffffff" : "#0C1A2B"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: hovered ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      stroke={hovered ? "#ffffff" : "#0C1A2B"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
