"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { PageHeader } from "@/components/elements/PageHeader";
import { Card } from "@/components/elements/Card";
import { ProjectionPlanner } from "./component/ProjectionPlanner";
import { ApyHistoryChart } from "./component/ApyHistoryChart";
import { SimulateTab } from "./component/SimulateTab";
import { StrategyPicker } from "@/modules/strategy/component/StrategyPicker";
import { useUserVault } from "@/hooks/useUserVault";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useStrategies, type StrategyView } from "@/hooks/useStrategies";
import { useChatStore } from "@/hooks/useChatStore";
import { cn } from "@/utils/cn";
import type { StrategyId } from "@/hooks/useRiskLevel";

function buildTendsAgentPrompt(id: StrategyId, strategies: StrategyView[]): string {
  const s = strategies.find((s) => s.id === id);
  if (!s) return `Evaluate the ${id} strategy for my portfolio and give me your recommendation.`;
  const apy = s.blendedApyPct != null ? `${s.blendedApyPct}%` : s.apyLabel;
  return `I'm considering the ${id} strategy for my portfolio: ${s.allocation} (estimated APY ${apy}, risk: ${s.risk}). Can you evaluate whether this suits my profile and give me a recommendation?`;
}

export function Analytics() {
  const { address } = useAccount();
  const { vaultAddress } = useUserVault();
  const { totalAssetsUSDC } = usePortfolio(vaultAddress, address);
  const { strategies } = useStrategies();
  const { openChat } = useChatStore();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>("LOW");
  const [tab, setTab] = useState<"overview" | "simulate">("overview");

  const handleAskTendsAgent = () => {
    openChat(buildTendsAgentPrompt(selectedStrategy, strategies));
  };

  return (
    <>
      <PageHeader title="Analytics" />
      <div className="space-y-6">

        {/* Tab switcher */}
        <div className="flex w-fit gap-1 rounded-lg border border-[#DDE8F2] p-0.5 dark:border-white/10">
          {(["overview", "simulate"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-4 py-1.5 font-mono text-xs capitalize transition-colors",
                tab === t
                  ? "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15"
                  : "text-[#5B7490] dark:text-white/45",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {/* Combined Strategy + Projection card */}
            <Card>
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <h3 className="font-sans text-sm font-semibold text-[#0C1A2B] dark:text-white">
                  Strategy &amp; Projection
                </h3>
                <button
                  onClick={handleAskTendsAgent}
                  className="flex items-center gap-1.5 rounded-lg border border-[#DDE8F2] px-3 py-1.5 font-mono text-xs text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC] dark:border-white/10 dark:text-white/45 dark:hover:border-[#4BB8FA] dark:hover:text-[#4BB8FA]"
                >
                  <MessageCircle size={13} />
                  Ask Tends Agent
                </button>
              </div>

              {/* Side-by-side grid — stacks on mobile */}
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[#DDE8F2] dark:lg:divide-white/10">
                {/* Left — Strategy picker */}
                <div className="lg:pr-6">
                  <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
                    Strategy
                  </p>
                  {vaultAddress ? (
                    <StrategyPicker
                      vaultAddress={vaultAddress}
                      onSelect={setSelectedStrategy}
                    />
                  ) : (
                    <p className="text-sm text-[#5B7490] dark:text-white/45">
                      Deploy your vault first to set a strategy.
                    </p>
                  )}
                </div>

                {/* Right — Projection */}
                <div className="lg:pl-6">
                  <p className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
                    Projection
                  </p>
                  <ProjectionPlanner
                    bare
                    initialCapital={totalAssetsUSDC}
                    strategy={selectedStrategy}
                  />
                </div>
              </div>
            </Card>

            {/* APY Projection chart */}
            <ApyHistoryChart />
          </>
        )}

        {tab === "simulate" && (
          <SimulateTab initialCapital={totalAssetsUSDC} />
        )}

      </div>
    </>
  );
}
