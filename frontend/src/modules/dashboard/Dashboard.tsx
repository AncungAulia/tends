"use client";

import { useState } from "react";
import { motion, type Variants } from "motion/react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { Spinner } from "@/components/elements/Spinner";
import { useUserVault } from "@/hooks/useUserVault";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ConnectPrompt } from "./component/ConnectPrompt";
import { PausedBanner } from "./component/PausedBanner";
import { PortfolioCard } from "./component/PortfolioCard";
import { Holdings } from "./component/Holdings";
import { AgentCard } from "./component/AgentCard";
import { Onboarding } from "@/modules/onboarding/Onboarding";
import { Deposit } from "@/modules/deposit/Deposit";
import { Withdraw } from "@/modules/withdraw/Withdraw";

const BENTO_CONTAINER: Variants = {
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

type ActiveModal = "deposit" | "withdraw" | null;

export function Dashboard() {
  const { ready, authenticated, login } = usePrivy();
  const { address } = useAccount();
  const { hasVault, vaultAddress, initialDeposit, refetch: refetchVault } = useUserVault();
  const {
    totalAssetsUSDC,
    lastRebalanceTime,
    paused,
    isLoading,
    refetch: refetchPortfolio,
  } = usePortfolio(vaultAddress, address);

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
      <div className="mx-auto max-w-5xl px-8 py-8">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B] dark:text-white">
              Overview
            </h1>
            <p className="mt-1 text-sm text-[#5B7490] dark:text-white/45">
              Where your money sits today.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setModal("withdraw")}
              className="rounded-full border-[1.25px] border-[#E8EAEC] bg-white px-4 py-2 text-sm font-medium text-[#5B7490] transition-colors hover:text-[#0C1A2B] dark:border-white/10 dark:bg-white/5 dark:text-white/45 dark:hover:text-white"
            >
              Withdraw
            </button>
            <button
              onClick={() => setModal("deposit")}
              className="rounded-full bg-[#1591DC] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Deposit
            </button>
          </div>
        </div>

        {paused && (
          <div className="mt-4">
            <PausedBanner />
          </div>
        )}

        {/* Bento grid */}
        <motion.div
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
          initial="hidden"
          animate="show"
          variants={BENTO_CONTAINER}
        >
          <PortfolioCard
            totalAssetsUSDC={totalAssetsUSDC}
            delta={deltaPct}
            isLoading={isLoading && !!hasVault}
          />
          <Holdings vaultAddress={vaultAddress} />
          <AgentCard />
        </motion.div>
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
