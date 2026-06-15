'use client';

import { useEffect, useRef } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Lenis = any;

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Disable browser scroll restoration — selalu mulai dari atas
    if (typeof window !== 'undefined') {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }

    let lenis: Lenis;

    const init = async () => {
      const { default: LenisClass } = await import('lenis');

      lenis = new LenisClass({
        // Heavier, weightier glide: a longer settle + slightly damped input so
        // the scroll carries momentum instead of snapping to a stop.
        duration: 1.6,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.4,
        syncTouch: true,
      });

      lenisRef.current = lenis;

      // Expose the instance so other components (e.g. HeroSection's
      // click-autoscroll) can drive programmatic scroll THROUGH Lenis.
      // Native window.scrollTo conflicts with Lenis — Lenis re-pins the
      // scroll position to its own internal target on the next frame, so a
      // native scrollTo gets silently reverted. Always use lenis.scrollTo().
      (window as unknown as { lenis?: Lenis }).lenis = lenis;

      // Connect Lenis to GSAP ScrollTrigger
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      const { gsap }          = await import('gsap');
      gsap.registerPlugin(ScrollTrigger);

      lenis.on('scroll', ScrollTrigger.update);

      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });

      gsap.ticker.lagSmoothing(0);
    };

    init();

    return () => {
      lenisRef.current?.destroy();
      lenisRef.current = null;
      delete (window as unknown as { lenis?: Lenis }).lenis;
    };
  }, []);

  return <>{children}</>;
}
