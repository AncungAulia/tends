'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const messages = [
  {
    state: 'thinking',
    text:  'Checking your portfolio.',
    sub:   'Running every 15 minutes.',
  },
  {
    state: 'found',
    text:  'Found a better opportunity.',
    sub:   'Conditions shifted. Your agent noticed.',
  },
  {
    state: 'acting',
    text:  'Making a move.',
    sub:   'Quietly. No approval needed.',
  },
  {
    state: 'done',
    text:  'Done. Your money is working harder.',
    sub:   'Back to monitoring. Always.',
  },
];

export default function AgentInAction() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const rows = sectionRef.current!.querySelectorAll<HTMLElement>('.aia-row');

      rows.forEach((row, i) => {
        gsap.set(row, { opacity: 0, y: 24 });

        ScrollTrigger.create({
          trigger: row,
          start: 'top 82%',
          onEnter: () =>
            gsap.to(row, { opacity: 1, y: 0, duration: 0.7, delay: i * 0.08, ease: 'power3.out' }),
          onLeaveBack: () =>
            gsap.to(row, { opacity: 0, y: 24, duration: 0.35, ease: 'power2.in' }),
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-bg py-36 px-8"
      style={{ borderTop: '1px solid #DDE8F2' }}
    >
      <div className="max-w-4xl mx-auto">
        <p className="font-sans text-muted text-sm mb-14">Agent activity</p>

        <h2
          className="font-sans font-bold text-text leading-[0.92] tracking-[-0.03em] mb-20"
          style={{ fontSize: 'clamp(2.8rem, 6vw, 5rem)' }}
        >
          Your agent,<br />at work.
        </h2>

        <div className="flex flex-col">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="aia-row flex items-start gap-8 py-7"
              style={{
                borderBottom: '1px solid #DDE8F2',
                borderTop: i === 0 ? '1px solid #DDE8F2' : undefined,
              }}
            >
              <div className="flex-shrink-0 mt-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: msg.state === 'done' ? '#1591DC' : '#DDE8F2' }}
                />
              </div>

              <div className="flex-1 flex items-baseline justify-between gap-8">
                <p
                  className="font-sans font-bold text-text leading-tight tracking-[-0.01em]"
                  style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}
                >
                  {msg.text}
                </p>
                <p className="font-sans text-muted text-sm whitespace-nowrap flex-shrink-0">
                  {msg.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex items-center gap-6">
          <a
            href="/chat"
            className="font-mono text-[0.65rem] uppercase tracking-[0.1em] bg-blue-primary text-white px-6 py-3.5 hover:bg-blue-light transition-colors duration-200"
          >
            Talk to your agent →
          </a>
          <a
            href="/strategies"
            className="font-sans text-sm text-muted hover:text-text transition-colors duration-200"
          >
            See strategies
          </a>
        </div>
      </div>
    </section>
  );
}
