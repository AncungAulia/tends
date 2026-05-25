"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export default function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const linkEls = useRef<(HTMLAnchorElement | null)[]>([]);
  const [btnHovered, setBtnHovered] = useState(false);

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
      pillRef.current.style.background = "rgba(255,255,255,0.10)";
      linkEls.current.forEach((el) => {
        if (el) el.style.color = "rgba(255,255,255,0.80)";
      });
    };

    const setLight = () => {
      if (!pillRef.current || !logoRef.current) return;
      logoRef.current.style.color = "#0C1A2B";
      pillRef.current.style.background = "rgba(247,249,252,0.92)";
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
      style={{ top: "36px", left: "70px", right: "70px" }}
    >
      <span
        ref={logoRef}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="font-sans font-semibold text-[1.5rem] tracking-[-0.02em] transition-colors duration-300"
        style={{ cursor: "pointer" }}
      >
        Tends.
      </span>

      <div
        ref={pillRef}
        className="flex items-center gap-1 p-4 rounded-2xl border transition-all duration-300"
        style={{
          background: "rgba(255,255,255,0.10)",
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
            background: "#0C1A2B",
            color: btnHovered ? "#0C1A2B" : "#ffffff",
            fontSize: "0.9rem",
            padding: "14px 22px",
            borderRadius: "12px",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            transition: "color 0.4s ease",
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
              transition: "height 0.4s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>Launch App</span>
        </a>
      </div>
    </nav>
  );
}
