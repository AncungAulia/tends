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
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true,
      });

      lenisRef.current = lenis;

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
    };
  }, []);

  return <>{children}</>;
}
