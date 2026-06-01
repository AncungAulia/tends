"use client";

import { Card } from "@/components/elements/Card";
import { Skeleton } from "@/components/elements/Skeleton";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { formatBalance, formatUSD, formatPercent } from "@/utils/format";

interface HoldingsTableProps {
  vaultAddress?: `0x${string}`;
  onDeposit?: () => void;
}

export function HoldingsTable({ vaultAddress, onDeposit }: HoldingsTableProps) {
  const { holdings, totalValueUSD, isLoading } = useVaultHoldings(vaultAddress);

  return (
    <Card className="p-0">
      <h3 className="border-b border-[#DDE8F2] px-6 py-4 font-sans text-sm font-semibold text-[#0C1A2B] dark:border-white/8 dark:text-white">
        Holdings
      </h3>

      {isLoading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-sm text-[#5B7490] dark:text-white/45">No holdings yet.</p>
          <p className="text-xs text-[#5B7490]/60 dark:text-white/30">
            Tends Agent begins working after your first deposit.
          </p>
          {onDeposit && (
            <button
              onClick={onDeposit}
              className="mt-1 font-mono text-xs uppercase tracking-[0.06em] text-[#1591DC] hover:underline"
            >
              Deposit USDC
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DDE8F2] text-left font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:border-white/8 dark:text-white/45">
                <th className="px-6 py-2 font-normal">Symbol</th>
                <th className="px-6 py-2 text-right font-normal">Balance</th>
                <th className="px-6 py-2 text-right font-normal">Value (USD)</th>
                <th className="px-6 py-2 text-right font-normal">Allocation</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[#0C1A2B] dark:text-white">
              {holdings.map((h) => {
                const alloc =
                  h.valueUSD !== null && totalValueUSD > 0
                    ? (h.valueUSD / totalValueUSD) * 100
                    : null;
                return (
                  <tr key={h.address} className="border-b border-[#DDE8F2]/60 last:border-0 dark:border-white/5">
                    <td className="px-6 py-3 font-sans font-medium">{h.symbol}</td>
                    <td className="px-6 py-3 text-right">{formatBalance(h.balanceHuman)}</td>
                    <td className="px-6 py-3 text-right">
                      {h.valueUSD !== null ? (
                        formatUSD(h.valueUSD)
                      ) : (
                        <span className="text-[#5B7490] dark:text-white/40" title="Price data is being updated by the oracle">
                          --
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {alloc !== null ? formatPercent(alloc) : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
