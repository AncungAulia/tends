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
        <h2 className="font-sans text-xl font-bold tracking-tight text-ink">
          Deploy Your Vault
        </h2>
        <p className="mt-2 text-sm text-dim">
          A personal smart contract that holds and manages your RWA portfolio on
          Mantle.
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-dim">
        <li>· Tends Agent rebalances automatically</li>
        <li>· You can withdraw anytime</li>
        <li>· One-time deployment</li>
      </ul>

      <div className="flex items-center justify-between rounded-lg border border-edge px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-[0.06em] text-dim">
          Network
        </span>
        <span className="font-mono text-xs text-ink">
          Mantle Sepolia
        </span>
      </div>

      {error ? <p className="text-sm text-neg">{error}</p> : null}

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
