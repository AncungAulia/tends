"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsMobile } from "@/lib/useIsMobile";

const TEXT = "Always on. Always optimizing. Zero effort.";

export default function HorizontalWords() {
  const outerRef  = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const textRef   = useRef<HTMLDivElement>(null);
  const isMobile  = useIsMobile();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const text = textRef.current!;
      const letters = text.querySelectorAll<HTMLElement>(".hw-letter");

      const pinnedDist = window.innerHeight * 2.5;

      // Horizontal scroll tied to the outer div scroll
      const scrollTween = gsap.timeline({
        scrollTrigger: {
          trigger: outerRef.current,
          start: "top top",
          end: () => `+=${pinnedDist}`,
          scrub: 1.5,
          invalidateOnRefresh: true,
        },
      });

      scrollTween.fromTo(
        text,
        { x: () => window.innerWidth * 0.15 },
        {
          x: () => -(text.scrollWidth - window.innerWidth * 0.85),
          ease: "none",
        },
      );

      // Letter bounce
      letters.forEach((letter) => {
        gsap.from(letter, {
          yPercent: (Math.random() - 0.5) * 300,
          rotation: (Math.random() - 0.5) * 30,
          ease: "power3.out",
          scrollTrigger: {
            trigger: letter,
            containerAnimation: scrollTween,
            start: "left 95%",
            end: "left 45%",
            scrub: 0.8,
          },
        });
      });
    }, outerRef);

    return () => ctx.revert();
  }, []);

  return (
    /* Outer div drives scroll distance; inner sticky handles pinning */
    <div ref={outerRef} style={{ height: isMobile ? "320vh" : "510vh" }} className="bg-bg">
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center"
        style={{

        }}
      >
        <div ref={textRef} className="whitespace-nowrap will-change-transform">
          <p
            className="font-sans font-bold leading-none tracking-[-0.03em] text-text select-none"
            style={{ fontSize: "clamp(5rem, 12vw, 10rem)" }}
            aria-label={TEXT}
          >
            {TEXT.split("").map((char, i) => (
              <span
                key={i}
                className="hw-letter inline-block"
                aria-hidden="true"
                style={{ color: char === "." ? "#1591DC" : undefined }}
              >
                {char === " " ? " " : char}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
