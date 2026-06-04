"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/elements/PageHeader";
import { Spinner } from "@/components/elements/Spinner";
import { useUserVault } from "@/hooks/useUserVault";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ConnectPrompt } from "./component/ConnectPrompt";
import { PausedBanner } from "./component/PausedBanner";
import { SummaryBar } from "./component/SummaryBar";
import { HoldingsTable } from "./component/HoldingsTable";
import { AgentActivityFeed } from "./component/AgentActivityFeed";
import { QuickActions } from "./component/QuickActions";
import { Onboarding } from "@/modules/onboarding/Onboarding";
import { Deposit } from "@/modules/deposit/Deposit";
import { Withdraw } from "@/modules/withdraw/Withdraw";

type ActiveModal = "deposit" | "withdraw" | null;

export function Dashboard() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { hasVault, vaultAddress, initialDeposit, refetch: refetchVault } =
    useUserVault();
  const {
    totalAssetsUSDC,
    riskPreference,
    lastRebalanceTime,
    paused,
    isLoading,
    refetch: refetchPortfolio,
  } = usePortfolio(vaultAddress, address);

  // Real P&L delta: current value vs cost basis (deposited). Hidden when the
  // cost basis isn't available (e.g. backend down) — never a fake 0%.
  const depositUSDC = initialDeposit ? Number(initialDeposit) / 1e6 : 0;
  const deltaPct =
    depositUSDC > 0
      ? ((totalAssetsUSDC - depositUSDC) / depositUSDC) * 100
      : undefined;

  const [modal, setModal] = useState<ActiveModal>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const close = () => setModal(null);
  const refresh = () => {
    refetchVault();
    refetchPortfolio();
  };

  if (!ready) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!authenticated) {
    return <ConnectPrompt onConnect={login} />;
  }

  return (
    <>
      <PageHeader title="Portfolio" />

      {paused && <PausedBanner />}

      <div className="space-y-8">
        <SummaryBar
          vaultAddress={vaultAddress}
          totalAssetsUSDC={totalAssetsUSDC}
          delta={deltaPct}
          riskPreference={riskPreference}
          lastRebalanceTime={lastRebalanceTime}
          paused={paused}
          isLoading={isLoading && hasVault}
        />

        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <HoldingsTable
            vaultAddress={vaultAddress}
            onDeposit={() => setModal("deposit")}
          />
          <AgentActivityFeed />
        </div>

        <QuickActions
          paused={paused}
          onDeposit={() => setModal("deposit")}
          onWithdraw={() => setModal("withdraw")}
        />
      </div>

      {vaultAddress && (
        <>
          <Deposit
            open={modal === "deposit"}
            onClose={close}
            vaultAddress={vaultAddress}
            paused={paused}
            onSuccess={refresh}
          />
          <Withdraw
            open={modal === "withdraw"}
            onClose={close}
            vaultAddress={vaultAddress}
            onSuccess={refresh}
          />
        </>
      )}

      {!hasVault && !onboardingDismissed && (
        <Onboarding
          onComplete={refresh}
          onDismiss={() => setOnboardingDismissed(true)}
        />
      )}
    </>
  );
}
