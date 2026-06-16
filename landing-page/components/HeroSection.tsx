"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsMobile } from "@/lib/useIsMobile";
import LineWaves from "./LineWaves";
import LogoMarquee from "./LogoMarquee";
import ChooseYourAgentHeadline, {
  type ChooseYourAgentHeadlineHandle,
} from "./ChooseYourAgentHeadline";
import BotPrism from "./BotPrism";
import StrategyAccordion from "./StrategyAccordion";

// Phase split thresholds for the slidesOuterRef ScrollTrigger (total 1400vh).
// Exported to module scope so the headline's click callback can compute the
// auto-scroll target without duplicating constants.
const SLIDE_END = 0.5;
const REVEAL_END = 0.64;
const FALL_TRIGGER = 0.78;

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
  // Three stacked masks for the staggered ripple reveal at end of slides.
  // mask1 (deepest blue) expands first, mask2 (mid) follows, mask3 (white)
  // closes — concentric rings before all merge into pure white.
  const mask1Ref = useRef<HTMLDivElement>(null);
  const mask2Ref = useRef<HTMLDivElement>(null);
  const mask3Ref = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<ChooseYourAgentHeadlineHandle>(null);
  // Cross-effect refs for headline trigger sync + scroll-direction tracking.
  // didTriggerFallRef is shared between the ScrollTrigger onUpdate (which sets
  // it on forward-scroll trigger) AND the headline's onFallStart callback
  // (which sets it on click-triggered fall). Either path now lets the
  // reverse-scroll recovery logic fire correctly.
  const didTriggerFallRef = useRef(false);
  const lastPRef = useRef(-1);
  const recoveryStartedAtRef = useRef<number | null>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeIdx  = useRef(-1);
  const entryDone  = useRef(false);
  const [hovered, setHovered] = useState(false);
  // Tends bot: mounted only while the interactive phase is on screen (so the
  // R3F canvas isn't running elsewhere), and faded/scaled in once the headline
  // falls — they appear together.
  const [botMounted, setBotMounted] = useState(false);
  const [botShown, setBotShown] = useState(false);
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

    return () => {
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

    // Phase thresholds (SLIDE_END / REVEAL_END / FALL_TRIGGER) live at
    // module scope — see top of file. Layout:
    //   [0.00, 0.014)   PRE         — section hasn't entered yet
    //   [0.014, 0.50)   SLIDE       — slide carousel (3 cards, ~233vh each)
    //   [0.50, 0.64)    REVEAL      — staggered 3-layer circle reveal
    //   [0.64, 0.78)    INTERACT/C  — headline, hover color shifts
    //   [0.78, 1.00]    INTERACT/F  — fall fires, recovery hold on scroll-up

    // Phase tracker (closure) — lets us run entry/exit logic only on phase
    // transitions, not on every scroll tick.
    let phase: "pre" | "slide" | "reveal" | "interactive" = "pre";

    // Navbar tint follows the WHITE reveal circle reaching the top-left logo
    // (scroll-tied) — not a flip at the phase boundary, which left the logo
    // white-on-white for a moment before snapping dark.
    let navDark = false;
    const setNavDark = (v: boolean) => {
      if (v === navDark) return;
      navDark = v;
      window.dispatchEvent(
        new CustomEvent("tends:whitephase", { detail: v }),
      );
    };

    // Holds the section "paused" on scroll-up while the exit plays out: bot
    // pops away, the accordion slides out (reverse), then the headline fades
    // back in (delayed). Long enough to cover the whole sequence.
    const RECOVERY_MS = 1250;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: slidesOuterRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;

          // Recovery lock — same as before, but reads/writes through refs
          // so click-triggered falls can participate too.
          const now = performance.now();
          const inRecovery =
            recoveryStartedAtRef.current !== null &&
            now - recoveryStartedAtRef.current < RECOVERY_MS;
          if (recoveryStartedAtRef.current !== null && !inRecovery) {
            recoveryStartedAtRef.current = null;
            didTriggerFallRef.current = false;
          }

          // Scroll-direction detection — required so recovery only fires
          // when the user is actually moving up, not the instant they click
          // (which can sync didTriggerFallRef before any scroll happens).
          const goingBackward =
            lastPRef.current !== -1 && p < lastPRef.current;
          lastPRef.current = p;

          const naturalPhase: typeof phase =
            p < 0.014
              ? "pre"
              : p < SLIDE_END
                ? "slide"
                : p < REVEAL_END
                  ? "reveal"
                  : "interactive";
          let nextPhase: typeof phase = inRecovery
            ? "interactive"
            : naturalPhase;

          // ── Boundary intercept: interactive → reveal backward ─────────
          // Without this, a click that fires the fall while the user is
          // sitting NEAR REVEAL_END (e.g., they just barely entered the
          // interactive phase) leads to the user scrolling up past
          // REVEAL_END in one tick — the interactive block never gets a
          // chance to run its restore branch, and the circle transition
          // kicks in with no text fade-in. We catch the crossing here.
          if (
            !inRecovery &&
            phase === "interactive" &&
            nextPhase === "reveal" &&
            didTriggerFallRef.current &&
            goingBackward
          ) {
            headlineRef.current?.restore();
            setBotShown(false);
            recoveryStartedAtRef.current = now;
            nextPhase = "interactive"; // lock for this tick (and onwards)
          }

          // ─── Phase transitions ─────────────────────────────────────
          if (nextPhase !== phase) {
            const fromPhase = phase;
            phase = nextPhase;

            // Pre: hide whole slide overlay
            if (nextPhase === "pre") {
              if (activeIdx.current !== -1) {
                textRefs.current[activeIdx.current]?.classList.remove(
                  "visible",
                );
                activeIdx.current = -1;
              }
              gsap.to(slidesOverRef.current, {
                autoAlpha: 0,
                duration: 0.2,
                overwrite: true,
              });
            }

            // Slide: section enters from above OR scrolling back from reveal
            if (nextPhase === "slide") {
              if (fromPhase === "pre") {
                gsap.to(slidesOverRef.current, {
                  autoAlpha: 1,
                  duration: 0.4,
                  overwrite: true,
                });
              } else {
                // Snap back from reveal — no fade, slides immediately visible
                if (slidesOverRef.current) {
                  slidesOverRef.current.style.opacity = "1";
                  slidesOverRef.current.style.visibility = "visible";
                }
              }
            }

            // Leaving reveal (forward to interactive OR backward to slide) —
            // collapse the staggered ripple circles. NOTE: when entering
            // interactive, we then re-pin mask3 at full coverage right after.
            if (fromPhase === "reveal") {
              if (mask1Ref.current)
                mask1Ref.current.style.clipPath = "circle(0px at 50% 50%)";
              if (mask2Ref.current)
                mask2Ref.current.style.clipPath = "circle(0px at 50% 50%)";
              if (mask3Ref.current)
                mask3Ref.current.style.clipPath = "circle(0px at 50% 50%)";
            }

            // Mount the bot canvas as early as the REVEAL phase so its WebGL
            // context + shaders are warm before the fall. Otherwise the very
            // first scroll-down hits a cold canvas and the accordion (plain
            // DOM) shows before the bot. It only unmounts when we leave the
            // section entirely (slide/pre), so re-scrolls stay warm too.
            if (nextPhase === "reveal" || nextPhase === "interactive") {
              setBotMounted(true);
            }
            if (nextPhase === "slide" || nextPhase === "pre") {
              setBotMounted(false);
              setBotShown(false);
            }

            // Entering interactive: pin mask3 to full coverage and remove its
            // clip-path entirely so falling letters can render past the
            // viewport's diagonal radius (clip otherwise eats them mid-fall).
            if (nextPhase === "interactive" && mask3Ref.current) {
              mask3Ref.current.style.clipPath = "none";
            }

            // Leaving interactive backward (scroll-up) → reset headline + hide
            // the bot. Stay mounted (we're going to reveal, still in section).
            if (fromPhase === "interactive") {
              headlineRef.current?.reset();
              didTriggerFallRef.current = false;
              recoveryStartedAtRef.current = null;
              setBotShown(false);
            }
          }

          // ─── Per-tick updates ──────────────────────────────────────
          if (phase === "pre") {
            setNavDark(false);
            if (progressFillRef.current)
              progressFillRef.current.style.width = "0%";
            return;
          }

          if (phase === "reveal") {
            // Reveal phase: scroll-tied circle grow + slides fade
            const revealRaw = (p - SLIDE_END) / (REVEAL_END - SLIDE_END);

            // Slides + eyebrow fade out in the FIRST 40% of reveal, so they're
            // already gone before the circle reaches their bounding rectangle.
            const slideOpacity = Math.max(0, Math.min(1, 1 - revealRaw * 2.5));
            if (slidesOverRef.current) {
              slidesOverRef.current.style.opacity = String(slideOpacity);
            }

            // ─ Staggered ripple: 3 concentric circles ─────────────────
            const STAGGER = 0.06;
            const SPAN = 0.62;
            const tFor = (i: number) =>
              Math.max(0, Math.min(1, (revealRaw - i * STAGGER) / SPAN));
            const ease = (t: number) => t * t * (3 - 2 * t);

            const halfDiag =
              Math.sqrt(
                window.innerWidth * window.innerWidth +
                  window.innerHeight * window.innerHeight,
              ) / 2;
            const maxR = halfDiag * 1.06;

            if (mask1Ref.current)
              mask1Ref.current.style.clipPath = `circle(${ease(tFor(0)) * maxR}px at 50% 50%)`;
            if (mask2Ref.current)
              mask2Ref.current.style.clipPath = `circle(${ease(tFor(1)) * maxR}px at 50% 50%)`;
            const m3r = ease(tFor(2)) * maxR;
            if (mask3Ref.current)
              mask3Ref.current.style.clipPath = `circle(${m3r}px at 50% 50%)`;

            // The logo (top-left corner) sits ~0.86·halfDiag from the center;
            // flip the navbar dark the moment the white circle edge sweeps
            // over it — so it tracks the scroll instead of snapping at 0.64.
            setNavDark(m3r >= halfDiag * 0.86);
            return;
          }

          if (phase === "interactive") {
            setNavDark(true); // full-white screen → dark logo
            // Hold off any new triggers while the restore animation is
            // playing — the section is "paused" for that window.
            if (inRecovery) return;

            // Forward: cross FALL_TRIGGER → fire fall (one shot) + reveal bot.
            if (p >= FALL_TRIGGER) {
              if (!didTriggerFallRef.current) {
                headlineRef.current?.triggerFall();
                didTriggerFallRef.current = true;
                setBotShown(true);
              }
            } else if (didTriggerFallRef.current && goingBackward) {
              // Reverse + actually scrolling backward (not just sitting
              // there after a click). Fire one-shot restore and lock the
              // phase via recovery. Hide the bot again.
              headlineRef.current?.restore();
              setBotShown(false);
              recoveryStartedAtRef.current = now;
            }
            return;
          }

          // phase === "slide" — blue slides bg, logo stays white
          setNavDark(false);
          // Map p ∈ [0.014, SLIDE_END) onto the 3 slides
          const slideP = (p - 0.014) / (SLIDE_END - 0.014);
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

          // Apple-style class-toggle: outgoing slide loses `.visible` (animates
          // out via CSS transition); incoming slide gains it (animates in).
          if (prev >= 0) {
            textRefs.current[prev]?.classList.remove("visible");
          }
          textRefs.current[next]?.classList.add("visible");
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
        className="load-overlay"
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
                <a
                  href="https://app.tends.fun"
                  target="_blank"
                  rel="noopener noreferrer"
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
                    textDecoration: "none",
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
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Transition strip: infinite logo marquee (partners + stack) ── */}
      <LogoMarquee />

      {/* ── Section 2: Slides + Circle reveal + Interactive headline ──
          Section height 1400vh = ~700vh slide phase + ~200vh reveal phase
          + ~500vh interactive (color change + headline fall + hold). Sticky
          child stays pinned the whole time; phase is decided by ScrollTrigger
          progress in the effect above. */}
      <div
        ref={slidesOuterRef}
        style={{ height: "1400vh", position: "relative", zIndex: 2 }}
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
                    }}
                  >
                    <div
                      style={{
                        // No more overflow:hidden — Apple-style reveal uses
                        // blur + scale (no Y translate), so no clipping needed.
                        paddingBottom: "0.05em",
                      }}
                    >
                      <div
                        ref={(el) => {
                          textRefs.current[i] = el;
                        }}
                        className="apple-reveal-text"
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

          {/* ── Staggered ripple reveal — 3 stacked mask layers ─────────
              Each is a full-bleed solid clipped to a growing circle. They
              expand at staggered times, so the user sees a concentric ring
              of colors collapse inward → outward. Bottom (deepest blue)
              expands first; top (white) is delayed and holds the headline.
              All sit ABOVE slidesOverRef during the reveal phase. */}
          {/* Layer 1: first ripple — primary brand blue */}
          <div
            ref={mask1Ref}
            style={{
              position: "absolute",
              inset: 0,
              background: "#1591DC",
              clipPath: "circle(0px at 50% 50%)",
              willChange: "clip-path",
              zIndex: 3,
              pointerEvents: "none",
            }}
          />
          {/* Layer 2: middle ripple — lighter blue (transition tone) */}
          <div
            ref={mask2Ref}
            style={{
              position: "absolute",
              inset: 0,
              background: "#4BB8FA",
              clipPath: "circle(0px at 50% 50%)",
              willChange: "clip-path",
              zIndex: 4,
              pointerEvents: "none",
            }}
          />
          {/* Layer 3: final mask — white, masks in "Choose Your Agent".
              Headline is an interactive component: hover → color shift,
              click → letters fall. Scroll within interactive phase drives
              the same color shift, and at FALL_TRIGGER auto-fires the fall. */}
          <div
            ref={mask3Ref}
            style={{
              position: "absolute",
              inset: 0,
              background: "#F7F9FC",
              clipPath: "circle(0px at 50% 50%)",
              willChange: "clip-path",
              zIndex: 5,
              // pointer-events here is "none" so the layer doesn't block
              // mouse events on slides during the reveal — the headline
              // itself opts back in via its own inline style.
              pointerEvents: "none",
            }}
          >
            {/* Headline owns its own layout (centering + physics container).
                Click-to-fall + autoscroll were removed — the fall is driven
                purely by scroll (triggerFall() at FALL_TRIGGER). */}
            <ChooseYourAgentHeadline ref={headlineRef} isMobile={isMobile} />

            {/* Bot (left) pops in first; the accordion cards (right) then slide
                in from the right one by one. Each hides via its own animation
                (bot scale 0, cards slid off-screen) so no overlay opacity is
                needed. overflow:hidden clips the off-screen cards. */}
            {botMounted && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  gap: isMobile ? "12px" : "4%",
                  // Pushed down so it clears the navbar.
                  padding: isMobile ? "96px 18px 24px" : "140px 5% 24px",
                }}
              >
                {/* Bot — left */}
                <div
                  style={{
                    flex: "0 0 38%",
                    width: isMobile ? "100%" : undefined,
                    height: isMobile ? "38vh" : "min(70vh, 520px)",
                    pointerEvents: "none",
                  }}
                >
                  <BotPrism
                    variant="glossy"
                    morphMode="bend"
                    revealed={botShown}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>

                {/* Accordion — right */}
                <div
                  style={{
                    flex: isMobile ? "1 1 auto" : "0 0 54%",
                    width: isMobile ? "100%" : undefined,
                    pointerEvents: botShown ? "auto" : "none",
                  }}
                >
                  <StrategyAccordion
                    show={botShown}
                    height={isMobile ? "min(46vh, 360px)" : "min(70vh, 520px)"}
                    maxWidth="100%"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
