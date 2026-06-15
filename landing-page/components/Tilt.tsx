"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/* Lightweight 3D tilt-on-hover (same effect as React Bits' TiltedCard, minus
   the framer-motion dependency). The card rotates toward the cursor and lifts
   slightly; a short transform transition gives the springy follow + smooth
   reset. Disabled on touch (no hover). */

export default function Tilt({
  children,
  amplitude = 8,
  scale = 1.02,
  style,
}: {
  children: ReactNode;
  /** Max tilt in degrees. */
  amplitude?: number;
  /** Scale applied while hovering. */
  scale?: number;
  style?: CSSProperties;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    if (!frame || !inner) return;
    const r = frame.getBoundingClientRect();
    const ox = e.clientX - r.left - r.width / 2;
    const oy = e.clientY - r.top - r.height / 2;
    const rx = (oy / (r.height / 2)) * -amplitude;
    const ry = (ox / (r.width / 2)) * amplitude;
    inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`;
  };

  const onLeave = () => {
    if (innerRef.current)
      innerRef.current.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  };

  return (
    <div
      ref={frameRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: 1000, ...style }}
    >
      <div
        ref={innerRef}
        style={{
          width: "100%",
          transformStyle: "preserve-3d",
          // Slower, gentler follow + reset so the tilt feels natural, not snappy.
          transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1)",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
