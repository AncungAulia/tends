"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useIsMobile } from "@/lib/useIsMobile";

export default function Navbar() {
  const navRef  = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const linkEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [btnHovered, setBtnHovered] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Entry animation — slide in setelah hero zoom selesai (~1.5s)
    gsap.set(navRef.current, { autoAlpha: 0, y: -16 });
    gsap.to(navRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      delay: 1.15,
    });

    const setDark = () => {
      if (!pillRef.current || !logoRef.current) return;
      logoRef.current.style.color = "#ffffff";
      pillRef.current.style.background = "rgba(255,255,255,0.00)";
      linkEls.current.forEach((el) => {
        if (el) el.style.color = "rgba(255,255,255,0.80)";
      });
    };

    const setLight = () => {
      if (!pillRef.current || !logoRef.current) return;
      logoRef.current.style.color = "#0C1A2B";
      pillRef.current.style.background = "rgba(247,249,252,0.00)";
      linkEls.current.forEach((el) => {
        if (el) el.style.color = "#5B7490";
      });
    };

    const whiteSection = document.querySelector(
      "[data-white-section]",
    ) as HTMLElement | null;
    const footer = document.querySelector("footer") as HTMLElement | null;

    const onScroll = () => {
      const footerRect = footer?.getBoundingClientRect();
      if (footerRect && footerRect.top < 80) {
        setDark();
        return;
      }
      if (!whiteSection) return;
      const rect = whiteSection.getBoundingClientRect();
      if (rect.top < 80 && rect.bottom > 0) setLight();
      else setDark();
    };

    setDark();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed z-50 flex justify-between items-center"
      style={{
        top: isMobile ? "20px" : "36px",
        left: "var(--nav-inset)",
        right: "var(--nav-inset)",
      }}
    >
      <span
        ref={logoRef}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="font-sans font-semibold tracking-[-0.02em] transition-colors duration-300"
        style={{
          cursor: "pointer",
          fontSize: isMobile ? "1.15rem" : "1.5rem",
        }}
      >
        Tends.
      </span>

      <div
        ref={pillRef}
        className="flex items-center gap-1 rounded-2xl transition-all duration-300"
        style={{
          background: "rgba(255,255,255,0.00)",
          padding: isMobile ? "6px" : "16px",
        }}
      >
        <a
          href="/app"
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            position: "relative",
            overflow: "hidden",
            display: "inline-flex",
            alignItems: "center",
            gap: "14px",
            background: "#0C1A2B",
            color: btnHovered ? "#0C1A2B" : "#ffffff",
            fontSize: isMobile ? "0.7rem" : "0.78rem",
            padding: isMobile ? "10px 10px 10px 16px" : "12px 12px 12px 22px",
            borderRadius: isMobile ? "10px" : "12px",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            transition: "color 0.65s ease",
            cursor: "pointer",
          }}
        >
          {/* Wipe layer — slides up from bottom */}
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: btnHovered ? "100%" : "0%",
              background: "#ffffff",
              transition: "height 0.65s cubic-bezier(0.4,0,0.2,1)",
              zIndex: 0,
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>Launch App</span>
          {/* Icon — rocket, no circle, warna ikut text */}
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
            <span
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                transform: btnHovered ? "translate(200%, -200%)" : "translate(0, 0)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/>
                <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>
              </svg>
            </span>
            <span
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                transform: btnHovered ? "translate(0, 0)" : "translate(-200%, 200%)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09"/>
                <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"/>
              </svg>
            </span>
          </span>
        </a>
      </div>
    </nav>
  );
}
