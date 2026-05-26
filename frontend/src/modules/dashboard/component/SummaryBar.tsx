"use client";

import { StatCard } from "@/components/elements/StatCard";
import { Badge, RISK_BADGE, STATUS_BADGE } from "@/components/elements/Badge";
import { Skeleton } from "@/components/elements/Skeleton";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { formatUSD, relativeTime, RISK_LABELS } from "@/utils/format";

const RISK_META: Record<string, string> = {
  LOW: "Treasuries & stable yield",
  MEDIUM: "Balanced basket",
  HIGH: "Yield max · higher risk",
  CUSTOM: "Your own allocation",
};

interface SummaryBarProps {
  vaultAddress?: `0x${string}`;
  totalAssetsUSDC: number;
  /** Real P&L % vs deposited cost basis. Undefined → no chip shown. */
  delta?: number;
  riskPreference?: number;
  lastRebalanceTime?: bigint;
  paused: boolean;
  isLoading: boolean;
}

export function SummaryBar({
  vaultAddress,
  totalAssetsUSDC,
  delta,
  riskPreference,
  lastRebalanceTime,
  paused,
  isLoading,
}: SummaryBarProps) {
  const { holdings } = useVaultHoldings(vaultAddress);

  if (isLoading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-[#DDE8F2] p-7 dark:border-white/8">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const risk = riskPreference !== undefined ? RISK_LABELS[riskPreference] : undefined;
  const riskLabel = risk ? risk.charAt(0) + risk.slice(1).toLowerCase() : undefined;
  const rebalanced = lastRebalanceTime && lastRebalanceTime > 0n;
  const rebalance = rebalanced
    ? relativeTime(new Date(Number(lastRebalanceTime) * 1000))
    : "--";

  const assetCount = holdings.length;
  const totalMeta =
    assetCount > 0
      ? `${assetCount} asset${assetCount === 1 ? "" : "s"} held`
      : "No assets yet";

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Portfolio"
        value={formatUSD(totalAssetsUSDC)}
        delta={delta}
        meta={totalMeta}
      />
      <StatCard
        label="Risk Level"
        compact
        value={
          risk && riskLabel ? (
            <Badge className={RISK_BADGE[risk]}>{riskLabel}</Badge>
          ) : (
            "--"
          )
        }
        meta={risk ? RISK_META[risk] : "Not set yet"}
      />
      <StatCard
        label="Last Rebalance"
        compact
        value={rebalance}
        meta={rebalanced ? "Automatic · Agent Hermes" : "Not yet rebalanced"}
      />
      <StatCard
        label="Status"
        compact
        accent={paused ? "warning" : "default"}
        value={
          <Badge className={paused ? STATUS_BADGE.paused : STATUS_BADGE.active}>
            {paused ? "Paused" : "Active"}
          </Badge>
        }
        meta={paused ? "Deposits paused · withdrawals open" : "Withdrawals always open"}
      />
    </div>
  );
}
