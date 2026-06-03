"use client";

import { useEffect, useRef } from "react";
import GlassSurface from "./GlassSurface";

interface LogoSpec {
  src: string;
  alt: string;
  /** Per-logo height override (px). Visual size varies per file based on
   *  how much transparent padding each image has. */
  height?: number;
}

// Partners — order: Alchemy, Hermes, Mantle, Privy, RedStone, Circle.
const LOGOS: LogoSpec[] = [
  { src: "/logos/alchemy.svg", alt: "Alchemy", height: 48 },
  { src: "/logos/hermes.webp", alt: "Hermes", height: 68 },
  { src: "/logos/mantle.svg", alt: "Mantle", height: 48 },
  { src: "/logos/privy.png", alt: "Privy", height: 44 },
  { src: "/logos/redstone.png", alt: "RedStone", height: 46 },
  { src: "/logos/circle.png", alt: "Circle", height: 46 },
];

// Render twice — translateX wraps modulo (halfTrackWidth) so the loop point
// lands at the start of the second copy = seamless.
const TRACK = [...LOGOS, ...LOGOS];

// Translate pixels per scroll pixel. 0.4 ≈ subtle, follows scroll without
// feeling either dragged or runaway. Lower = slower, higher = faster.
const SCROLL_FACTOR = 0.4;

export default function LogoMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;
    let pending = false;

    const update = () => {
      pending = false;
      const track = trackRef.current;
      if (!track) return;
      const halfWidth = track.offsetWidth / 2;
      if (halfWidth <= 0) return;
      // Wrap with modulo so the track loops at the duplicate seam.
      const offset = (window.scrollY * SCROLL_FACTOR) % halfWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // initial position

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section
      aria-label="Partners"
      style={{
        position: "relative",
        zIndex: 2,
        // marginTop sits below the hero's bg expand trigger (scrollY 80).
        // The marquee enters the viewport naturally as the user continues
        // scrolling — it doesn't animate in alongside the bg expand.
        marginTop: 120,
      }}
    >
      <GlassSurface
        className="logo-marquee-glass"
        width="100%"
        height={104}
        borderRadius={0}
        backgroundOpacity={0.2}
        saturation={1.8}
        blur={11}
        displace={0}
        distortionScale={-180}
        redOffset={0}
        greenOffset={10}
        blueOffset={20}
        mixBlendMode="difference"
      >
        <div className="logo-marquee-viewport">
          <div ref={trackRef} className="logo-marquee-track">
            {TRACK.map((logo, i) => (
              <div key={i} className="logo-marquee-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={logo.alt}
                  draggable={false}
                  style={{
                    height: logo.height ?? 48,
                    width: "auto",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </GlassSurface>

      <style>{`
        /* Force WHITE frost tint regardless of color-scheme. */
        .logo-marquee-glass.glass-surface--svg {
          background: hsl(0 0% 100% / var(--glass-frost, 0));
        }
        /* Override GlassSurface __content so marquee can span full width
           and clip its overflow cleanly. */
        .logo-marquee-glass .glass-surface__content {
          padding: 0;
          justify-content: flex-start;
          overflow: hidden;
        }
        .logo-marquee-viewport {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          position: relative;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
        }
        .logo-marquee-track {
          display: flex;
          width: max-content;
          will-change: transform;
          /* No CSS animation — transform is driven by scrollY in the effect above. */
        }
        .logo-marquee-item {
          padding-right: 96px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          height: 80px;
        }
      `}</style>
    </section>
  );
}
