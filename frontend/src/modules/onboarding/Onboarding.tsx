"use client";

import { useRef, useState } from "react";
import { useUserVault } from "@/hooks/useUserVault";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { Spinner } from "@/components/elements/Spinner";
import { cn } from "@/utils/cn";
import { StepDeployVault } from "./component/StepDeployVault";
import { StepSetStrategy } from "./component/StepSetStrategy";
import { StepFirstDeposit } from "./component/StepFirstDeposit";

/**
 * Onboarding overlay (3 steps). Rendered inside Dashboard when the user has no
 * vault yet. Stays mounted through the flow even after the vault is deployed.
 */
export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const {
    hasVault,
    vaultAddress,
    isVaultLoading,
    deployVault,
    isPending,
    isConfirming,
    error,
  } = useUserVault();

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const shouldShow = !isVaultLoading && !hasVault && !done;
  if (shouldShow) started.current = true;
  const visible = shouldShow || (started.current && !done);
  if (!visible) return null;

  const finish = () => {
    setDone(true);
    onComplete();
  };

  const handleDeploy = async () => {
    try {
      await deployVault();
      setStep(2);
    } catch {
      // error surfaced via the `error` prop in StepDeployVault
    }
  };

  return (
    <ResponsiveDialog open={visible} onClose={() => {}} locked>
      {/* Step dots */}
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 rounded-full transition-all",
              n === step ? "w-6 bg-[#1591DC]" : n < step ? "w-1.5 bg-[#1591DC]" : "w-1.5 bg-[#DDE8F2] dark:bg-white/15",
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <StepDeployVault
          onDeploy={handleDeploy}
          isPending={isPending}
          isConfirming={isConfirming}
          error={error}
        />
      )}

      {step >= 2 && !vaultAddress && (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      )}

      {step === 2 && vaultAddress && (
        <StepSetStrategy
          vaultAddress={vaultAddress}
          onNext={() => setStep(3)}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && vaultAddress && (
        <StepFirstDeposit vaultAddress={vaultAddress} onDone={finish} onSkip={finish} />
      )}
    </ResponsiveDialog>
  );
}
