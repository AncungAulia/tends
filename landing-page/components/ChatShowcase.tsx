"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import ChatConversation from "./ChatConversation";
import InteractiveChat from "./InteractiveChat";

/* Pinned, guided chat beat:
   1. "Just chat." holds, then blur-swaps into the chat home card.
   2. When the home card is reached the page LOCKS - the visitor cannot scroll
      past. The only way forward is to click the pulsing send button.
   3. Clicking expands the card automatically and plays the scripted
      conversation (see InteractiveChat). The action card waits for a real
      Approve / Decline.
   4. Once resolved, scrolling unlocks and the (now expanded) conversation
      scrolls away to the next section.
   No em-dashes in copy. */

const NAVY = "#0C1A2B";
const MUTED = "#5B7490";
const SANS = "var(--font-sans)";

const SECTION_VH = 240;
const SHOW_CHAT = 0.2; // copy -> chat home
const LOCK_AT = 0.36; // chat home reached -> lock scroll

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const copyBlock = (
  <div>
    <h2
      style={{
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: "clamp(3.5rem, 13vw, 11rem)",
        lineHeight: 0.92,
        letterSpacing: "-0.04em",
        color: NAVY,
        margin: 0,
      }}
    >
      Just chat.
    </h2>
    <p
      style={{
        fontFamily: SANS,
        fontWeight: 400,
        fontSize: "clamp(1.05rem, 1.8vw, 1.5rem)",
        lineHeight: 1.5,
        color: MUTED,
        margin: "28px auto 0",
        maxWidth: "34ch",
      }}
    >
      Ask your agent anything, or tell it to make a move. It handles the on-chain work
      for you.
    </p>
  </div>
);

export default function ChatShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  const [reduce, setReduce] = useState(false);
  const [expanded, setExpanded] = useState(false); // card grows on send click
  const [done, setDone] = useState(false); // interaction finished -> unlock
  const [scrolledAway, setScrolledAway] = useState(false); // user moved on after it finished

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduce(true);
      return;
    }
    const setSize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    setSize();
    let raf = 0;
    let pending = false;
    const update = () => {
      pending = false;
      const el = ref.current;
      if (!el) return;
      const dist = el.offsetHeight - window.innerHeight;
      setP(dist > 0 ? clamp(-el.getBoundingClientRect().top / dist, 0, 1) : 0);
    };
    const onScroll = () => {
      if (!pending) {
        pending = true;
        raf = requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", setSize);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", setSize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll lock, in two phases (works with native scroll and with Lenis):
  //   "down" - at the chat home, before the send click: block scrolling further
  //            DOWN, but let the visitor scroll back UP to the prior sections.
  //   "full" - after the send click, until the scripted beat resolves: block
  //            both directions so the clip plays like a short video.
  const lockMode = reduce || done ? "none" : expanded ? "full" : p > LOCK_AT ? "down" : "none";
  useEffect(() => {
    if (lockMode === "none") return;
    const lenis = (
      window as unknown as {
        lenis?: { stop?: () => void; start?: () => void; scrollTo?: (t: number, o?: object) => void };
      }
    ).lenis;
    const down = lockMode === "down";

    const downKeys = new Set(["ArrowDown", "PageDown", "End", " ", "Spacebar"]);
    const upKeys = new Set(["ArrowUp", "PageUp", "Home"]);
    // Pin point for the down-only phase: never let the page move past here going
    // down, but upward stays free.
    const lockedY = window.scrollY;

    const onWheel = (e: WheelEvent) => {
      if (!down) return e.preventDefault();
      if (e.deltaY > 0) e.preventDefault();
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!down) return e.preventDefault();
      const y = e.touches[0]?.clientY ?? 0;
      if (y < touchY) e.preventDefault(); // finger swipes up = scrolling down
    };
    const onKey = (e: KeyboardEvent) => {
      if (!down) {
        if (downKeys.has(e.key) || upKeys.has(e.key)) e.preventDefault();
        return;
      }
      if (downKeys.has(e.key)) e.preventDefault();
    };
    // Safeguard (mainly for Lenis, which animates past a prevented wheel): snap
    // back if anything pushes the page below the pin while in down-only mode.
    const onScroll = () => {
      if (down && window.scrollY > lockedY) {
        if (lenis?.scrollTo) lenis.scrollTo(lockedY, { immediate: true, force: true });
        else window.scrollTo(0, lockedY);
      }
    };

    if (!down) lenis?.stop?.();
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey, { passive: false });
    if (down) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (!down) lenis?.start?.();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [lockMode]);

  // Once the beat is done, watch for the first scroll so the "scroll to
  // continue" hint can retire itself the moment the visitor moves on.
  useEffect(() => {
    if (!done) return;
    const onScroll = () => setScrolledAway(true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [done]);

  const showChat = p > SHOW_CHAT;

  // Card size: compact home -> expanded, animated on the send click.
  const compactW = Math.min(720, vp.w - 40);
  const expandedW = Math.min(1120, vp.w * 0.92);
  const compactH = Math.min(480, vp.h * 0.76);
  const expandedH = vp.h * 0.86;
  const cardW = expanded ? expandedW : compactW;
  const cardH = expanded ? expandedH : compactH;

  // ── Reduced motion: copy screen, then the static conversation card ──
  if (reduce) {
    const screen: CSSProperties = {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F7F9FC",
      padding: "clamp(48px, 8vw, 96px) clamp(20px, 6vw, 96px)",
    };
    return (
      <>
        <section style={{ ...screen, textAlign: "center" }}>{copyBlock}</section>
        <section style={screen}>
          <div
            style={{
              width: "100%",
              maxWidth: 1120,
              background: "#fff",
              border: "1px solid #E2EAF3",
              borderRadius: 28,
              boxShadow: "0 26px 70px rgba(20,40,70,0.12)",
              padding: "clamp(24px, 3vw, 36px)",
            }}
          >
            <ChatConversation />
          </div>
        </section>
      </>
    );
  }

  const overlay: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(32px, 5vw, 64px) clamp(20px, 5vw, 72px)",
    willChange: "opacity, filter, transform",
  };
  const SWAP = "opacity 0.6s ease, filter 0.6s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1)";

  return (
    <section ref={ref} style={{ position: "relative", height: `${SECTION_VH}vh`, background: "#F7F9FC" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        {/* copy */}
        <div
          style={{
            ...overlay,
            textAlign: "center",
            opacity: showChat ? 0 : 1,
            filter: showChat ? "blur(12px)" : "blur(0px)",
            transform: showChat ? "translateY(-24px)" : "translateY(0)",
            transition: SWAP,
            pointerEvents: showChat ? "none" : "auto",
          }}
        >
          {copyBlock}
        </div>

        {/* chat card */}
        <div
          style={{
            ...overlay,
            opacity: showChat ? 1 : 0,
            filter: showChat ? "blur(0px)" : "blur(12px)",
            transform: showChat ? "translateY(0)" : "translateY(24px)",
            transition: SWAP,
            pointerEvents: showChat ? "auto" : "none",
          }}
        >
          <div
            style={{
              width: cardW,
              height: cardH,
              maxWidth: "100%",
              background: "#ffffff",
              border: "1px solid #E2EAF3",
              borderRadius: 28,
              boxShadow: "0 26px 70px rgba(20,40,70,0.12)",
              padding: "clamp(20px, 2.4vw, 30px)",
              transition: "width 0.85s cubic-bezier(0.16,1,0.3,1), height 0.85s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <InteractiveChat onStart={() => setExpanded(true)} onComplete={() => setDone(true)} />
          </div>
        </div>

        {/* finished cue: tells the visitor the clip is over and scrolling is free */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 26,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: done && !scrolledAway ? 1 : 0,
            transition: "opacity 0.5s ease",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: "0.01em", color: MUTED }}>
            Scroll to continue
          </span>
          <span className="scroll-hint-bob" style={{ display: "inline-flex", color: MUTED }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </section>
  );
}
