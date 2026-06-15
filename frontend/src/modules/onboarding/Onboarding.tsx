"use client";

import { useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useUserVault } from "@/hooks/useUserVault";
import { apiFetch } from "@/lib/api";
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
export function Onboarding({ onComplete, onDismiss }: { onComplete: () => void; onDismiss: () => void }) {
  const { getAccessToken } = usePrivy();
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
  const [completed, setCompleted] = useState(false);
  const started = useRef(false);

  const shouldShow = !isVaultLoading && !hasVault && !completed;
  if (shouldShow) started.current = true;
  const visible = (shouldShow || started.current) && !completed;
  if (!visible) return null;

  const finish = () => {
    setCompleted(true);
    onComplete();
  };

  const handleDeploy = async () => {
    try {
      await deployVault();
      // Save the name the user entered in the wizard, now that the vault exists.
      const pendingName = localStorage.getItem("tends_pending_name");
      if (pendingName) {
        try {
          const token = await getAccessToken();
          await apiFetch("/api/users/me/profile", token, {
            method: "PATCH",
            body: JSON.stringify({ name: pendingName }),
          });
        } catch { /* non-critical */ }
        localStorage.removeItem("tends_pending_name");
      }
      setStep(2);
    } catch {
      // error surfaced via the `error` prop in StepDeployVault
    }
  };

  return (
    <ResponsiveDialog
      open={visible}
      onClose={onDismiss}
      locked={isPending || isConfirming}
    >
      {/* Step dots */}
      <div className="mb-5 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 rounded-full transition-all",
              n === step ? "w-6 bg-brand" : n < step ? "w-1.5 bg-brand" : "w-1.5 border-edge bg-edge",
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
