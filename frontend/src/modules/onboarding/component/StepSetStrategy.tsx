"use client";

import { StrategyPicker } from "@/modules/strategy/component/StrategyPicker";

interface Props {
  vaultAddress: `0x${string}`;
  onNext: () => void;
  onSkip: () => void;
}

export function StepSetStrategy({ vaultAddress, onNext, onSkip }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-xl font-bold tracking-tight text-[#0C1A2B] dark:text-white">
          Choose Your Strategy
        </h2>
        <p className="mt-2 text-sm text-[#5B7490] dark:text-white/45">
          Tends Agent will rebalance your vault according to your risk preference.
        </p>
      </div>

      <StrategyPicker
        vaultAddress={vaultAddress}
        saveLabel="Continue"
        onSaved={onNext}
      />

      <button
        onClick={onSkip}
        className="w-full font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] hover:text-[#0C1A2B] dark:text-white/45 dark:hover:text-white"
      >
        Skip for now
      </button>
    </div>
  );
}
