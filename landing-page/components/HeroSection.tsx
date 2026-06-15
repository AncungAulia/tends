"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsMobile } from "@/lib/useIsMobile";
import LineWaves from "./LineWaves";
import LogoMarquee from "./LogoMarquee";

const SLIDES = [
  {
    title: "Connect",
    description:
      "Connect your wallet. The agent reads your portfolio instantly.",
  },
  {
    title: "Strategize",
    description: "Pick a strategy. Low, medium, high, or build your own.",
  },
  {
    title: "Deploy",
    description:
      "Deploy instantly. Your agent runs 24/7. No babysitting needed.",
  },
];

export default function HeroSection() {
  const videoBgRef = useRef<HTMLDivElement>(null);
  const videoInnerRef = useRef<HTMLDivElement>(null);
  const loadOverlayRef = useRef<HTMLDivElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const btnsRef = useRef<HTMLDivElement>(null);
  const slidesOuterRef = useRef<HTMLDivElement>(null);
  const slidesOverRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIdx  = useRef(-1);
  const entryDone  = useRef(false);
  const [hovered, setHovered] = useState(false);
  const isMobile    = useIsMobile();
  const isMobileRef = useRef(isMobile);

  // ── Entry animation: zoom dari lingkaran kecil ────────────────────
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    gsap.set(videoBgRef.current, {
      scale: 0,
      transformOrigin: "center center",
      autoAlpha: 1,
    });
    gsap.set(videoInnerRef.current, { borderRadius: "50%" });
    gsap.set(loadOverlayRef.current, { autoAlpha: 1 });
    gsap.set(
      [line1Ref.current, line2Ref.current, subRef.current, btnsRef.current],
      { yPercent: 110 },
    );

    tl.to(
      loadOverlayRef.current,
      { autoAlpha: 0, duration: 0.5, ease: "power2.in" },
      0,
    )
      .to(
        videoBgRef.current,
        { scale: 1, duration: 1.5, ease: "power3.inOut" },
        "<0.05",
      )
      .to(
        videoInnerRef.current,
        { borderRadius: "20px", duration: 1.5, ease: "power3.inOut" },
        "<",
      )
      .to(line1Ref.current, { yPercent: 0, duration: 1.0 }, ">-0.4")
      .to(line2Ref.current, { yPercent: 0, duration: 1.0 }, "<")
      .to(subRef.current, { yPercent: 0, duration: 1.0 }, "<")
      .to(btnsRef.current, { yPercent: 0, duration: 1.0 }, "<")
      .call(() => {
        entryDone.current = true;
      });

    const restoreFromHistory = (event: PageTransitionEvent) => {
      const navEntry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!event.persisted && navEntry?.type !== "back_forward") return;

      tl.progress(1).kill();
      entryDone.current = true;
      gsap.set(loadOverlayRef.current, { autoAlpha: 0 });
      gsap.set(videoBgRef.current, { scale: 1, autoAlpha: 1 });
      gsap.set(videoInnerRef.current, { borderRadius: "20px" });
      gsap.set(
        [line1Ref.current, line2Ref.current, subRef.current, btnsRef.current],
        { yPercent: 0 },
      );
      window.scrollTo(0, 0);
    };

    window.addEventListener("pageshow", restoreFromHistory);

    return () => {
      window.removeEventListener("pageshow", restoreFromHistory);
      tl.kill();
    };
  }, []);

  // ── Sync isMobileRef setiap isMobile berubah ─────────────────────
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);

  // ── Expand/restore frame berdasarkan scroll position ─────────────
  // Scroll-tied: padding & borderRadius interpolate continuously with scrollY.
  // No binary threshold + no GSAP tween — eliminates the on/off flicker that
  // happened when Lenis-smoothed scrollY repeatedly crossed the old threshold.
  useEffect(() => {
    const EXPAND_DISTANCE = 80; // px of scroll over which the frame fully expands
    const BASE_RADIUS = 20;

    let rafId = 0;
    let pending = false;

    const update = () => {
      pending = false;
      if (!entryDone.current) return;
      const basePadding = isMobileRef.current ? 8 : 14;
      const t = Math.min(1, Math.max(0, window.scrollY / EXPAND_DISTANCE));
      // Smoothstep (3t² − 2t³): linear in the middle, gentle at the endpoints
      // — kills the abrupt change you'd feel with a pure linear ramp.
      const eased = t * t * (3 - 2 * t);
      const pad = basePadding * (1 - eased);
      const radius = BASE_RADIUS * (1 - eased);
      if (videoBgRef.current) {
        videoBgRef.current.style.padding = `${pad}px`;
      }
      if (videoInnerRef.current) {
        videoInnerRef.current.style.borderRadius = `${radius}px`;
      }
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // sync once on mount (handles refresh-with-scroll-position case)

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Slides ────────────────────────────────────────────────────────
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (!slidesOuterRef.current) return;

    gsap.set(slidesOverRef.current, { autoAlpha: 0 });
    SLIDES.forEach((_, i) => {
      gsap.set(slideRefs.current[i], { autoAlpha: 0 });
      gsap.set(textRefs.current[i], { yPercent: 110 });
    });

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: slidesOuterRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;

          if (p < 0.02) {
            if (activeIdx.current !== -1) {
              activeIdx.current = -1;
              gsap.to(slidesOverRef.current, {
                autoAlpha: 0,
                duration: 0.2,
                overwrite: true,
              });
            }
            if (progressFillRef.current)
              progressFillRef.current.style.width = "0%";
            return;
          }

          if (activeIdx.current === -1) {
            gsap.to(slidesOverRef.current, {
              autoAlpha: 1,
              duration: 0.4,
              overwrite: true,
            });
          }

          const slideP = (p - 0.02) / 0.98;
          const raw = slideP * SLIDES.length;
          const next = Math.min(SLIDES.length - 1, Math.floor(raw));

          const withinSlide =
            next === SLIDES.length - 1
              ? Math.min(1, raw - (SLIDES.length - 1))
              : raw % 1;
          if (progressFillRef.current)
            progressFillRef.current.style.width = `${withinSlide * 100}%`;

          if (next === activeIdx.current) return;

          const prev = activeIdx.current;
          activeIdx.current = next;


          if (prev >= 0) {
            const dir = next > prev ? -110 : 110;
            gsap.to(textRefs.current[prev], {
              yPercent: dir,
              duration: 0.4,
              ease: "power3.in",
              overwrite: true,
            });
            gsap.to(slideRefs.current[prev], {
              autoAlpha: 0,
              duration: 0.3,
              delay: 0.1,
              overwrite: true,
            });
          }

          gsap.set(textRefs.current[next], {
            yPercent: next > prev ? 110 : -110,
          });
          gsap.set(slideRefs.current[next], { autoAlpha: 1 });
          gsap.to(textRefs.current[next], {
            yPercent: 0,
            duration: 0.7,
            ease: "power3.out",
            overwrite: true,
          });
        },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* ── Video background: fixed, shared hero & slides ──────────
          padding: 14px → menciptakan inset frame (putih dari page bg)
          TANPA border — frame dibuat oleh padding + overflow hidden    */}
      <div
        ref={videoBgRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "#ffffff",
          padding: isMobile ? "8px" : "14px",
        }}
      >
        <div
          ref={videoInnerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* Base: gradient biru-menengah (teal-petrol → royal → deep navy-blue),
              sesuai foto referensi. Tidak terlalu gelap supaya garis shader
              tidak jadi neon. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #1B6A85 0%, #1F4FA0 45%, #16306E 100%)",
            }}
          >
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
          {/* Overlay tipis untuk kontras teks putih, tidak menggelapkan terlalu banyak */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, rgba(12,26,43,0.32) 0%, rgba(12,26,43,0.10) 55%, rgba(12,26,43,0.28) 100%)",
            }}
          />
        </div>
      </div>

      {/* ── Page-load white overlay ───────────────────────────────── */}
      <div
        ref={loadOverlayRef}
        style={{
          position: "fixed",
          inset: 0,
          background: "#ffffff",
          zIndex: 100,
          pointerEvents: "none",
        }}
      />

      {/* ── Section 1: Hero content ───────────────────────────────── */}
      <section
        data-hero-section
        style={{ position: "relative", height: "100vh", zIndex: 2 }}
      >
        <div
          data-hero-content
          className="relative h-full flex flex-col pt-10 pb-12"
          style={{
            paddingLeft: isMobile ? "20px" : "30px",
            paddingRight: isMobile ? "20px" : "30px",
          }}
        >
          <div className="flex-1 flex flex-col justify-center pt-12">
            <h1
              className="font-sans font-normal text-white leading-[0.93] tracking-[-0.03em]"
              style={{
                fontSize: isMobile
                  ? "clamp(2.5rem, 10vw, 4rem)"
                  : "clamp(4rem, 9.5vw, 7rem)",
              }}
            >
              <div
                className="clip-line"
                style={{
                  paddingLeft: isMobile ? "0" : "20px",
                  paddingRight: isMobile ? "0" : "20px",
                }}
              >
                <div
                  ref={line1Ref}
                  style={{
                    paddingLeft: isMobile ? "0" : "20px",
                    paddingRight: isMobile ? "0" : "20px",
                  }}
                >
                  Fire your analyst,
                </div>
              </div>
              <div
                className="clip-line"
                style={{
                  paddingLeft: "0",
                  paddingRight: isMobile ? "0" : "20px",
                }}
              >
                <div
                  ref={line2Ref}
                  style={{
                    color: "white",
                    paddingLeft: isMobile ? "0" : "40px",
                    paddingRight: isMobile ? "0" : "20px",
                  }}
                >
                  deploy your agent.
                </div>
              </div>
            </h1>
          </div>

          <div
            className={
              isMobile
                ? "flex flex-col gap-4 pt-6"
                : "flex items-center justify-between gap-8 pt-8"
            }
            style={{ paddingBottom: "28px" }}
          >
            <div style={{ overflow: "hidden", paddingBottom: "0.2em" }}>
              <div ref={subRef}>
                <p
                  className="font-sans leading-relaxed text-white"
                  style={{
                    fontSize: isMobile
                      ? "clamp(0.95rem, 4vw, 1.1rem)"
                      : "clamp(1rem, 1.5vw, 1.5rem)",
                    maxWidth: "38ch",
                    paddingLeft: isMobile ? "0" : "40px",
                    paddingRight: isMobile ? "0" : "20px",
                    paddingBottom: "20px",
                  }}
                >
                  Agent-managed real world assets portfolios on Mantle.
                </p>
              </div>
            </div>

            <div style={{ overflow: "hidden", paddingBottom: "0.2em" }}>
              <div
                ref={btnsRef}
                style={{
                  paddingLeft: isMobile ? "0" : "40px",
                  paddingRight: isMobile ? "0" : "40px",
                  paddingBottom: "20px",
                }}
              >
                <button
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 12px 12px 22px",
                    background: "#ffffff",
                    border: "none",
                    borderRadius: "14px",
                    fontFamily: "var(--font-mono)",
                    fontSize: isMobile ? "0.7rem" : "0.78rem",
                    letterSpacing: 0,
                    textTransform: "uppercase",
                    color: hovered ? "#ffffff" : "#0C1A2B",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "color 0.65s ease",
                  }}
                >
                  {/* Wipe layer — slides up from bottom */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: hovered ? "100%" : "0%",
                      background: "#0C1A2B",
                      transition: "height 0.65s cubic-bezier(0.4,0,0.2,1)",
                      zIndex: 0,
                    }}
                  />
                  <span style={{ position: "relative", zIndex: 1 }}>Deploy Your Agent</span>
                  {/* Icon — arrow, no circle, warna ikut text */}
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      width: "13px",
                      height: "13px",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {/* arr-out: idle di tengah, hover keluar ke kanan-atas */}
                    <span
                      style={{
                        position: "absolute",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                        transform: hovered
                          ? "translate(200%, -200%)"
                          : "translate(0, 0)",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 12L12 2M12 2H5.5M12 2V8.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {/* arr-in: idle tersembunyi di kiri-bawah, hover masuk ke tengah */}
                    <span
                      style={{
                        position: "absolute",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                        transform: hovered
                          ? "translate(0, 0)"
                          : "translate(-200%, 200%)",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 12L12 2M12 2H5.5M12 2V8.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Transition strip: infinite logo marquee (partners + stack) ── */}
      <LogoMarquee />

      {/* ── Section 2: Slides — section terpisah di bawah hero ───── */}
      <div
        ref={slidesOuterRef}
        style={{ height: "720vh", position: "relative", zIndex: 2 }}
      >
        <div style={{ position: "sticky", top: 0, height: "100vh" }}>
          <div
            ref={slidesOverRef}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {/* Scroll progress bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "1.5px",
                background: "rgba(255,255,255,0.15)",
              }}
            >
              <div
                ref={progressFillRef}
                style={{
                  height: "100%",
                  width: "0%",
                  background: "rgba(255,255,255,0.75)",
                }}
              />
            </div>

            {/* ── Centered: "How It Works?" label + slide description ── */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: isMobile ? "24px" : "40px",
                // Wider container so slide 3 ("Deploy... no babysitting needed")
                // can fit in 2 lines instead of breaking to 3.
                width: isMobile ? "calc(100% - 40px)" : "min(1280px, 90vw)",
                textAlign: "center",
              }}
            >
              {/* Eyebrow label */}
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile
                    ? "clamp(0.95rem, 4vw, 1.15rem)"
                    : "clamp(1.4rem, 2.4vw, 1.85rem)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                How It Works?
              </span>

              {/* Slide stack — absolute children swap via opacity + Y animation.
                  minHeight reserves vertical space so siblings don't collapse. */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: isMobile ? "150px" : "210px",
                }}
              >
                {SLIDES.map((slide, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      slideRefs.current[i] = el;
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      opacity: 0,
                      visibility: "hidden",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        paddingBottom: "0.05em",
                      }}
                    >
                      <div
                        ref={(el) => {
                          textRefs.current[i] = el;
                        }}
                        style={{
                          color: "#ffffff",
                          fontFamily: "var(--font-sans)",
                          fontSize: isMobile
                            ? "clamp(1.85rem, 7.5vw, 2.6rem)"
                            : "clamp(2.6rem, 5.2vw, 5rem)",
                          fontWeight: 500,
                          lineHeight: 1.1,
                          letterSpacing: "-0.025em",
                          textAlign: "center",
                          // Balance line lengths — distributes characters more
                          // evenly so slide 3 wraps to 2 lines like the others
                          // (vs. orphaning "needed" on a third line).
                          textWrap: "balance",
                        }}
                      >
                        {slide.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
