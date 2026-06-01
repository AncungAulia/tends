"use client";

import { Button } from "@/components/elements/Button";

export function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex min-h-[78vh] flex-col items-center justify-center gap-7 px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
        Tends.
      </p>

      <div className="overflow-hidden pb-1">
        <h1 className="animate-[tends-rise_0.6s_cubic-bezier(0.22,1,0.36,1)] max-w-2xl font-sans text-3xl font-bold leading-[1.05] tracking-[-0.03em] text-[#0C1A2B] motion-reduce:animate-none dark:text-white sm:text-5xl">
          AI-managed RWA portfolios on Mantle.
        </h1>
      </div>

      <p className="max-w-md text-base leading-relaxed text-[#5B7490] dark:text-white/45">
        Connect your wallet to deploy a personal vault and let Tends Agent
        manage your strategy.
      </p>

      <Button icon onClick={onConnect}>
        Connect Wallet
      </Button>
    </div>
  );
}
