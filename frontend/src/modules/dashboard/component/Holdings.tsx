"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { TokenIcon, tokenColor } from "@/components/elements/TokenIcon";
import SlidingNumber from "@/components/elements/SlidingNumber";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";

const BENTO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export interface HoldingsProps {
  vaultAddress?: `0x${string}`;
}

export function Holdings({ vaultAddress }: HoldingsProps) {
  const { holdings, totalValueUSD, isLoading } = useVaultHoldings(vaultAddress);
  const [hover, setHover] = useState<number | null>(null);

  const shown = holdings.slice(0, 5);

  const centerPct =
    hover === null || hover >= shown.length
      ? 0
      : shown.slice(0, hover).reduce((s, h) => {
          const pct = totalValueUSD > 0 ? ((h.valueUSD ?? 0) / totalValueUSD) * 100 : 0;
          return s + pct;
        }, 0) +
        (totalValueUSD > 0 ? ((shown[hover]?.valueUSD ?? 0) / totalValueUSD) * 100 : 0) / 2;

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="rounded-2xl border-[1.25px] border-edge bg-card p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dim">
          Your Holdings
        </p>
        <Link
          href="/analytics"
          aria-label="Open plan"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-edge text-dim transition-colors hover:border-dim hover:text-ink dark:hover:border-white/20 dark:hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded bg-edge dark:bg-white/10" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-edge dark:bg-white/10" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-dim">No holdings yet.</p>
          <p className="text-xs text-faint">
            Deposit to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Segmented allocation bar */}
          <div className="relative">
            <div className="flex h-3.5">
              {shown.map((h, i) => {
                const pct = totalValueUSD > 0 ? ((h.valueUSD ?? 0) / totalValueUSD) * 100 : 0;
                return (
                  <div
                    key={h.symbol}
                    style={{
                      flexGrow: pct,
                      background: tokenColor(h.symbol),
                      marginLeft: i === 0 ? 0 : -5,
                      zIndex: shown.length - i,
                    }}
                    className="relative basis-0 cursor-pointer rounded-[3px]"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </div>

            <AnimatePresence>
              {hover !== null && hover < shown.length && (
                <motion.div
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 whitespace-nowrap rounded-lg bg-tip px-2.5 py-1.5 text-left shadow-lg"
                  style={{ left: `${centerPct}%`, transformOrigin: "bottom center" }}
                  initial={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
                  exit={{ opacity: 0, scale: 0.9, y: 4, x: "-50%" }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  <p className="text-xs font-semibold text-white">{shown[hover].symbol}</p>
                  <p className="text-[10px] text-white/55">
                    {totalValueUSD > 0 ? ((shown[hover].valueUSD ?? 0) / totalValueUSD * 100).toFixed(1) : "0"}% ·{" "}
                    ${(shown[hover].valueUSD ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="mt-3">
            {shown.map((h, i) => {
              const pct = totalValueUSD > 0 ? ((h.valueUSD ?? 0) / totalValueUSD) * 100 : 0;
              return (
                <div
                  key={h.symbol}
                  className={`flex items-center gap-3 py-2.5 ${i < shown.length - 1 ? "border-b border-edge" : ""}`}
                >
                  <TokenIcon sym={h.symbol} color={tokenColor(h.symbol)} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">{h.symbol}</p>
                    <p className="text-[10px] text-dim">
                      {h.balanceHuman.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                  <span className="w-10 text-right text-xs font-medium text-dim">
                    {pct.toFixed(1)}%
                  </span>
                  <div className="w-20 text-right">
                    {h.valueUSD !== null ? (
                      <p className="flex items-center justify-end text-sm font-semibold text-ink">
                        <span>$</span>
                        <SlidingNumber number={h.valueUSD} decimalPlaces={2} />
                      </p>
                    ) : (
                      <p className="text-sm text-faint">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}
