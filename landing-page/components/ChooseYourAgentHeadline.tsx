"use client";

import Matter from "matter-js";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const TEXT = "Choose Your Agent";

const START_COLOR = "#0C1A2B";

// Fade-in duration.
const FADE_DURATION_MS = 550;
// On scroll-up, wait this long before fading the headline back in, so it
// reappears only after the accordion has slid away.
const RESTORE_FADE_DELAY_MS = 700;

type FadeState = "normal" | "hidden" | "fading";

export interface ChooseYourAgentHeadlineHandle {
  /** Forward direction: kick off Matter.js falling animation. Idempotent. */
  triggerFall(): void;
  /** Reverse direction: stop Matter, restore words, play fade-in. */
  restore(): void;
  /** Full reset — used when leaving the interactive phase entirely. */
  reset(): void;
}

interface Props {
  isMobile: boolean;
}

const ChooseYourAgentHeadline = forwardRef<
  ChooseYourAgentHeadlineHandle,
  Props
>(({ isMobile }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [isFalling, setIsFalling] = useState(false);
  // Two-stage fade-in state machine — solves the "tek" (instant pop) bug
  // that happened with single-shot CSS animation: browsers occasionally
  // paint one frame at opacity:1 before the animation engine takes over.
  // By snapping to opacity 0 first (no transition) and only enabling the
  // transition on the NEXT frame, we guarantee a clean 0 → 1 fade.
  const [fadeState, setFadeState] = useState<FadeState>("normal");

  const words = useMemo(() => TEXT.split(" "), []);

  useImperativeHandle(ref, () => ({
    triggerFall() {
      setFadeState("normal"); // cancel any in-flight fade-in
      setIsFalling(true);
    },
    restore() {
      // Stop Matter; useEffect cleanup will restore the spans to flex layout.
      setIsFalling(false);
      // Snap to opacity 0 instantly (no transition yet).
      setFadeState("hidden");
    },
    reset() {
      setIsFalling(false);
      setFadeState("normal");
    },
  }));

  // ── Fade-in state machine: "hidden" → RAF → "fading" → onTransitionEnd → "normal"
  useEffect(() => {
    if (fadeState !== "hidden") return;
    // Wait (so the headline reappears AFTER the accordion exit), then switch
    // to "fading" — applying opacity:1 WITH the transition rule animates 0→1.
    const t = setTimeout(() => {
      requestAnimationFrame(() => setFadeState("fading"));
    }, RESTORE_FADE_DELAY_MS);
    return () => clearTimeout(t);
  }, [fadeState]);

  // ── Matter.js physics simulation ─────────────────────────────────────
  useEffect(() => {
    if (!isFalling) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    if (W <= 0 || H <= 0) return;

    const { Engine, World, Bodies, Runner, Body } = Matter;

    const engine = Engine.create();
    engine.gravity.y = 1.2;

    const wallOpts = {
      isStatic: true,
      render: { fillStyle: "transparent" },
    };
    const ceiling = Bodies.rectangle(W / 2, -25, W, 50, wallOpts);
    const leftWall = Bodies.rectangle(-25, H / 2, 50, H, wallOpts);
    const rightWall = Bodies.rectangle(W + 25, H / 2, 50, H, wallOpts);

    // PASS 1: read every word's rect BEFORE any detach from flex layout.
    const measured: {
      elem: HTMLSpanElement;
      w: number;
      h: number;
      x: number;
      y: number;
    }[] = [];
    for (const elem of wordRefs.current) {
      if (!elem) continue;
      const wRect = elem.getBoundingClientRect();
      measured.push({
        elem,
        w: wRect.width,
        h: wRect.height,
        x: wRect.left - rect.left + wRect.width / 2,
        y: wRect.top - rect.top + wRect.height / 2,
      });
    }

    // PASS 2: bodies + detach in one go.
    const wordBodies: { elem: HTMLSpanElement; body: Matter.Body }[] = [];
    for (const m of measured) {
      const body = Bodies.rectangle(m.x, m.y, m.w, m.h, {
        restitution: 0.55,
        frictionAir: 0.012,
        friction: 0.2,
      });
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 2,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12);

      m.elem.style.position = "absolute";
      m.elem.style.left = `${m.x}px`;
      m.elem.style.top = `${m.y}px`;
      m.elem.style.transform = "translate(-50%, -50%)";
      m.elem.style.margin = "0";

      wordBodies.push({ elem: m.elem, body });
    }

    World.add(engine.world, [
      ceiling,
      leftWall,
      rightWall,
      ...wordBodies.map((wb) => wb.body),
    ]);

    const runner = Runner.create();
    Runner.run(runner, engine);

    let rafId = 0;
    const loop = () => {
      for (const { elem, body } of wordBodies) {
        elem.style.left = `${body.position.x}px`;
        elem.style.top = `${body.position.y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();

    // The world has no floor (letters are meant to fall away), so left running
    // it spins forever — wasted CPU + ever-growing body positions. Once the
    // words are well off-screen, freeze the sim: stop the runner + rAF. The
    // spans keep their last (clipped, out-of-view) position until restore()
    // clears them. 4s is comfortably after they've left the viewport.
    const freezeTimer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      Runner.stop(runner);
    }, 4000);

    return () => {
      clearTimeout(freezeTimer);
      cancelAnimationFrame(rafId);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);

      for (const elem of wordRefs.current) {
        if (!elem) continue;
        elem.style.position = "";
        elem.style.left = "";
        elem.style.top = "";
        elem.style.transform = "";
        elem.style.margin = "";
      }
    };
  }, [isFalling]);

  // Click-to-fall, autoscroll and hover-tint all removed — the headline is
  // purely scroll-driven now.

  // Per fadeState: opacity + transition rule.
  //   normal — default visible, no transition
  //   hidden — instant snap to opacity 0 (no transition)
  //   fading — opacity 1 WITH transition active → browser animates 0 → 1
  const fadeStyle =
    fadeState === "hidden"
      ? { opacity: 0, transition: "none" as const }
      : fadeState === "fading"
        ? {
            opacity: 1,
            transition: `opacity ${FADE_DURATION_MS}ms ease-out` as const,
          }
        : { opacity: 1, transition: "none" as const };

  return (
    <div
      ref={containerRef}
      onTransitionEnd={(e) => {
        // Filter — h2's color transition also bubbles up here.
        if (e.propertyName === "opacity" && fadeState === "fading") {
          setFadeState("normal");
        }
      }}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        // Clip the falling word-spans: the Matter.js world has no floor, so the
        // letters keep falling forever after the drop. Without this clip their
        // absolute `top` grows unbounded and inflates the document height (the
        // scrollbar slowly drifts while idle). Clipped overflow is excluded from
        // scrollable height, so the page stays put — the "fall away" look is the
        // same since the words leave the viewport anyway.
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        ...fadeStyle,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: isMobile
            ? "clamp(2rem, 8.5vw, 3.4rem)"
            : "clamp(3rem, 5.5vw, 5rem)",
          letterSpacing: "-0.03em",
          lineHeight: 0.95,
          color: START_COLOR,
          margin: 0,
          textAlign: "center",
          padding: isMobile ? "0 24px" : "0 40px",
          cursor: "default",
          userSelect: "none",
          display: "inline-flex",
          gap: "0.32em",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {words.map((word, i) => (
          <span
            key={i}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
            style={{ display: "inline-block" }}
          >
            {word}
          </span>
        ))}
      </h2>
    </div>
  );
});

ChooseYourAgentHeadline.displayName = "ChooseYourAgentHeadline";

export default ChooseYourAgentHeadline;
