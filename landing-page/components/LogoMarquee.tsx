"use client";

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
  // Hermes: PNG has more padding around the figure, so render at a larger
  // height so the visible mark matches Alchemy/Mantle next to it.
  { src: "/logos/hermes.png", alt: "Hermes", height: 68 },
  { src: "/logos/mantle.svg", alt: "Mantle", height: 48 },
  { src: "/logos/privy.png", alt: "Privy", height: 44 },
  { src: "/logos/redstone.png", alt: "RedStone", height: 46 },
  { src: "/logos/circle.png", alt: "Circle", height: 46 },
];

// Render twice — keyframe goes 0 → -50%, landing the loop point at the start
// of the second copy = seamless. Each item uses padding-right (not flex gap)
// so the math is exact.
const TRACK = [...LOGOS, ...LOGOS];

export default function LogoMarquee() {
  return (
    <section
      aria-label="Partners"
      style={{
        position: "relative",
        zIndex: 2,
        // marginTop sits BELOW the hero's bg expand trigger (scrollY 80 in
        // HeroSection). The marquee enters the viewport naturally as the user
        // continues scrolling — it does NOT animate in alongside the bg expand.
        marginTop: 120,
      }}
    >
      <GlassSurface
        className="logo-marquee-glass"
        width="100%"
        height={104}
        borderRadius={0}
        // Glass settings:
        //   frost            → backgroundOpacity 0.20 (light white tint)
        //   dispersion       → default RGB offsets (0/10/20) at -180 scale
        //   saturation       → 1.8
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
          <div className="logo-marquee-track">
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
        /* Force WHITE frost tint regardless of color-scheme. GlassSurface
           ships with light-dark() default that flips to black in dark mode;
           we want white on this dark hero. */
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
          /* Soft edge fade — logos don't pop at the strip ends */
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 4%, black 96%, transparent 100%);
        }
        .logo-marquee-track {
          display: flex;
          width: max-content;
          animation: logo-marquee 38s linear infinite;
          will-change: transform;
        }
        .logo-marquee-item {
          padding-right: 96px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          height: 80px;
        }
        @keyframes logo-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}
