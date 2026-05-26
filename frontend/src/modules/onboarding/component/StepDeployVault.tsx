"use client";

import { Button } from "@/components/elements/Button";

interface Props {
  onDeploy: () => void;
  isPending: boolean;
  isConfirming: boolean;
  error: string | null;
}

export function StepDeployVault({ onDeploy, isPending, isConfirming, error }: Props) {
  const busy = isPending || isConfirming;
  const label = isPending
    ? "Confirm in wallet..."
    : isConfirming
      ? "Deploying vault..."
      : "Deploy Vault";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-xl font-bold tracking-tight text-[#0C1A2B] dark:text-white">
          Deploy Your Vault
        </h2>
        <p className="mt-2 text-sm text-[#5B7490] dark:text-white/45">
          A personal smart contract that holds and manages your RWA portfolio on
          Mantle.
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-[#5B7490] dark:text-white/45">
        <li>· Agent Hermes rebalances automatically</li>
        <li>· You can withdraw anytime</li>
        <li>· One-time deployment</li>
      </ul>

      <div className="flex items-center justify-between rounded-lg border border-[#DDE8F2] px-3 py-2 dark:border-white/10">
        <span className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
          Network
        </span>
        <span className="font-mono text-xs text-[#0C1A2B] dark:text-white">
          Mantle Sepolia
        </span>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <Button
        icon
        onClick={onDeploy}
        loading={busy}
        loadingLabel={label}
        className="w-full"
      >
        Deploy Vault
      </Button>
    </div>
  );
}
