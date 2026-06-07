"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useOnboardingWizard, ONBOARDING_LAST } from "@/hooks/useOnboardingWizard";
import { useUserVault } from "@/hooks/useUserVault";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ConnectWallet } from "@/components/onboarding/ConnectWallet";
import { StepHead } from "@/components/onboarding/StepHead";
import { NextButton } from "@/components/onboarding/NextButton";
import { ChoiceStep } from "@/components/onboarding/ChoiceStep";
import { OnboardingResult } from "@/components/onboarding/OnboardingResult";
import { GOAL, DIPS } from "@/components/onboarding/constants";

export default function OnboardingPage() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { step, dir, answers, setAnswers, risk, stopLoss, progress, forward, pick, go, valid } =
    useOnboardingWizard();
  const { hasVault, isVaultLoading } = useUserVault();
  const namePersisted = useRef(false);

  // If user already has a vault, skip the wizard entirely.
  useEffect(() => {
    if (authenticated && !isVaultLoading && hasVault) {
      router.push("/overview");
    }
  }, [authenticated, isVaultLoading, hasVault, router]);

  // skip connect step if wallet already authenticated
  useEffect(() => {
    if (authenticated && step === 0) go(1);
  }, [authenticated, step, go]);

  // Persist name to localStorage at the result step — the actual DB write
  // happens in Onboarding.tsx after the vault is successfully deployed.
  useEffect(() => {
    if (step === ONBOARDING_LAST && answers.name.trim() && !namePersisted.current) {
      namePersisted.current = true;
      localStorage.setItem("tends_pending_name", answers.name.trim());
    }
  }, [step, answers.name]);

  return (
    <OnboardingShell
      step={step}
      dir={dir}
      progress={progress}
      showBack={step > 0 && step < ONBOARDING_LAST}
      onBack={() => go(step - 1)}
    >
      {step === 0 && <ConnectWallet onConnect={login} />}

      {step === 1 && (
        <div>
          <StepHead title="First, what should we call you?" />
          <input
            autoFocus
            value={answers.name}
            onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && forward()}
            placeholder="Your name"
            className="w-full rounded-xl border-[1.25px] border-[#E8EAEC] bg-white px-4 py-3 text-lg font-medium outline-none transition-all placeholder:text-[#CBD5E1] focus:border-[#1591DC] focus:ring-2 focus:ring-[#1591DC]/15"
          />
          <NextButton onClick={forward} disabled={!valid(1)} />
        </div>
      )}

      {step === 2 && (
        <ChoiceStep
          title="What do you want this money to do?"
          options={GOAL}
          selected={answers.goal}
          onPick={(v) => pick("goal", v)}
        />
      )}

      {step === 3 && (
        <ChoiceStep
          title="If your balance dropped 10% in a week, you would..."
          options={DIPS}
          selected={answers.dips}
          onPick={(v) => pick("dips", v)}
        />
      )}

      {step === 4 && (
        <OnboardingResult name={answers.name} risk={risk} stopLoss={stopLoss} ctaHref="/overview" />
      )}
    </OnboardingShell>
  );
}
