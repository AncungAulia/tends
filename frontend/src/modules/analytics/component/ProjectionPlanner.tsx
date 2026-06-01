"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/elements/Card";
import { Input } from "@/components/elements/Input";
import { Skeleton } from "@/components/elements/Skeleton";
import { apiFetch } from "@/lib/api";
import { formatUSD, formatPercent } from "@/utils/format";
import { cn } from "@/utils/cn";

const STRATEGIES = ["LOW", "MEDIUM", "HIGH", "CUSTOM"] as const;
type StrategyId = (typeof STRATEGIES)[number];

interface ProjectionResult {
  capital: number;
  durationDays: number;
  blendedApyPct: number;
  base: number;
  best: number;
  worst: number;
}

export function ProjectionPlanner({ initialCapital, strategy: strategyProp, bare }: { initialCapital?: number; strategy?: StrategyId; bare?: boolean }) {
  const [strategy, setStrategy] = useState<StrategyId>(strategyProp ?? "LOW");

  useEffect(() => {
    if (strategyProp) setStrategy(strategyProp);
  }, [strategyProp]);
  const [capital, setCapital] = useState(() =>
    initialCapital != null && initialCapital > 0
      ? String(Math.round(initialCapital))
      : "1000",
  );
  const [durationDays, setDurationDays] = useState("180");
  const capitalSynced = useRef(false);
  useEffect(() => {
    if (!capitalSynced.current && initialCapital != null && initialCapital > 0) {
      setCapital(String(Math.round(initialCapital)));
      capitalSynced.current = true;
    }
  }, [initialCapital]);

  const [low, setLow] = useState("33");
  const [med, setMed] = useState("34");
  const [high, setHigh] = useState("33");

  const capitalNum = Number(capital);
  const durationNum = Number(durationDays);
  const isCustom = strategy === "CUSTOM";
  const total = Number(low) + Number(med) + Number(high);
  const customValid = !isCustom || total === 100;
  const valid = capitalNum > 0 && durationNum > 0 && customValid;

  const lowBps = Math.round(Number(low) * 100);
  const medBps = Math.round(Number(med) * 100);
  const customAllocation = isCustom
    ? { lowBps, medBps, highBps: 10_000 - lowBps - medBps }
    : undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "projection",
      strategy,
      capitalNum,
      durationNum,
      isCustom ? `${low}-${med}-${high}` : "",
    ],
    enabled: valid,
    queryFn: () =>
      apiFetch<ProjectionResult>("/api/projection", null, {
        method: "POST",
        body: JSON.stringify({
          strategyId: strategy,
          capital: capitalNum,
          durationDays: durationNum,
          ...(customAllocation ? { customAllocation } : {}),
        }),
      }),
  });

  const content = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
            Capital (USDC)
          </label>
          <Input
            type="number"
            min="0"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            className="font-mono"
          />
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
            Duration (days)
          </label>
          <Input
            type="number"
            min="1"
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      {isCustom && (
        <div className="mt-4 rounded-lg border border-[#DDE8F2] p-3 dark:border-white/10">
          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
            Custom allocation
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Low", value: low, set: setLow },
              { label: "Medium", value: med, set: setMed },
              { label: "High", value: high, set: setHigh },
            ].map((row) => (
              <div key={row.label}>
                <label className="mb-1 block text-xs text-[#5B7490] dark:text-white/45">
                  {row.label} %
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={row.value}
                  onChange={(e) => row.set(e.target.value)}
                  className="font-mono"
                />
              </div>
            ))}
          </div>
          <p
            className={cn(
              "mt-2 font-mono text-xs",
              total === 100 ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            Total: {total}% {total === 100 ? "✓" : "— must equal 100%"}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {!valid ? (
          <p className="text-sm text-[#5B7490] dark:text-white/45 sm:col-span-3">
            {isCustom && !customValid
              ? "Set a custom allocation that totals 100% to see a projection."
              : "Enter capital and duration to see a projection."}
          </p>
        ) : isError ? (
          <p className="text-sm text-[#5B7490] dark:text-white/45 sm:col-span-3">
            Projection is temporarily unavailable. Try again shortly.
          </p>
        ) : isLoading || !data ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : (
          <>
            <Projection label="Base" value={data.base} />
            <Projection label="Best" value={data.best} tone="up" />
            <Projection label="Worst" value={data.worst} tone="down" />
            <p className="font-mono text-xs text-[#5B7490] dark:text-white/45 sm:col-span-3">
              Blended APY: {formatPercent(data.blendedApyPct)}
            </p>
          </>
        )}
      </div>
    </>
  );

  if (bare) return content;

  return (
    <Card>
      <h3 className="mb-4 font-sans text-sm font-semibold text-[#0C1A2B] dark:text-white">
        Projection
      </h3>
      {content}
    </Card>
  );
}

function Projection({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-[#DDE8F2] p-4 dark:border-white/8">
      <p className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-xl font-bold",
            tone === "up" && "text-[#16A34A]",
            tone === "down" && "text-[#DC2626]",
            !tone && "text-[#0C1A2B] dark:text-white",
          )}
        >
          {formatUSD(value)}
        </span>
        {tone === "up" && (
          <TrendingUp size={18} strokeWidth={2.5} className="shrink-0 text-[#16A34A]" />
        )}
        {tone === "down" && (
          <TrendingDown size={18} strokeWidth={2.5} className="shrink-0 text-[#DC2626]" />
        )}
      </div>
    </div>
  );
}
