'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const steps = [
  {
    num: '01',
    title: 'Connect.',
    body: 'Sign in with email or Google. Your wallet is created automatically. No seed phrases. No prior crypto experience needed.',
  },
  {
    num: '02',
    title: 'Pick your strategy.',
    body: 'Choose Low, Medium, or High risk. Or drag sliders and build your own mix. Your allocation, your call.',
  },
  {
    num: '03',
    title: 'Deploy.',
    body: 'Your AI agent activates and manages everything around the clock. You just check in whenever you feel like it.',
  },
];

export default function HowItWorks() {
  const outerRef  = useRef<HTMLDivElement>(null);
  const stepEls   = useRef<(HTMLDivElement | null)[]>([]);
  const dotsRef   = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const outer = outerRef.current!;
      const els   = stepEls.current.filter(Boolean) as HTMLDivElement[];
      const dots  = dotsRef.current.filter(Boolean) as HTMLDivElement[];

      // Set initial states
      els.forEach((el, i) => {
        gsap.set(el, { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 28 });
      });
      dots.forEach((d, i) => {
        d.style.background = i === 0 ? '#1591DC' : '#DDE8F2';
      });

      const totalHeight = steps.length * window.innerHeight;

      ScrollTrigger.create({
        trigger: outer,
        start: 'top top',
        end: () => `+=${totalHeight - window.innerHeight}`,
        scrub: false,
        onUpdate: (self) => {
          const raw   = self.progress * steps.length;
          const index = Math.min(Math.floor(raw), steps.length - 1);

          els.forEach((el, i) => {
            const active = i === index;
            gsap.to(el, {
              opacity: active ? 1 : 0,
              y:       active ? 0 : (i < index ? -28 : 28),
              duration: 0.45,
              ease: 'power2.out',
              overwrite: true,
            });
          });

          dots.forEach((d, i) => {
            d.style.background    = i === index ? '#1591DC' : '#DDE8F2';
            d.style.boxShadow     = i === index ? '0 0 0 3px rgba(21,145,220,0.2)' : 'none';
          });
        },
      });
    }, outerRef);

    return () => ctx.revert();
  }, []);

  return (
    /* Outer gives scroll height, inner is CSS sticky */
    <div ref={outerRef} style={{ height: `${steps.length * 100}vh` }}>
      <div
        className="sticky top-0 h-screen flex overflow-hidden bg-bg"
        style={{ borderTop: '1px solid #DDE8F2' }}
      >
        {/* LEFT — always visible */}
        <div
          className="w-[44%] h-full flex flex-col justify-between px-12 py-14"
          style={{ borderRight: '1px solid #DDE8F2' }}
        >
          <p className="font-sans text-muted text-sm">Process</p>

          <div>
            <h2
              className="font-sans font-bold text-text leading-[0.9] tracking-[-0.03em]"
              style={{ fontSize: 'clamp(3.2rem, 6vw, 5.5rem)' }}
            >
              How it<br />works.
            </h2>
          </div>

          {/* Step dots */}
          <div className="flex flex-col gap-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  ref={(el) => { dotsRef.current[i] = el; }}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{ background: '#DDE8F2' }}
                />
                <span className="font-sans text-sm text-muted">{s.num}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — changing content */}
        <div className="w-[56%] h-full relative">
          {steps.map((step, i) => (
            <div
              key={i}
              ref={(el) => { stepEls.current[i] = el; }}
              className="absolute inset-0 flex flex-col justify-center px-14"
              style={{ pointerEvents: 'none' }}
            >
              <p className="font-sans text-muted text-sm mb-8">
                {step.num} / {String(steps.length).padStart(2, '0')}
              </p>
              <h3
                className="font-sans font-bold text-text leading-[0.93] tracking-[-0.025em] mb-7"
                style={{ fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}
              >
                {step.title}
              </h3>
              <p
                className="font-sans text-muted leading-relaxed"
                style={{ fontSize: 'clamp(1rem, 1.5vw, 1.15rem)', maxWidth: '38ch' }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
