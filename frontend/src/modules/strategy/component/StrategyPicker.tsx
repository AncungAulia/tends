"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/elements/Button";
import { Input } from "@/components/elements/Input";
import { useRiskLevel, type StrategyId } from "@/hooks/useRiskLevel";
import { useStrategies } from "@/hooks/useStrategies";
import { cn } from "@/utils/cn";

const OPTIONS: { id: StrategyId; num: number; label: string }[] = [
  { id: "LOW",    num: 0, label: "LOW" },
  { id: "MEDIUM", num: 1, label: "MEDIUM" },
  { id: "HIGH",   num: 2, label: "HIGH" },
  { id: "CUSTOM", num: 3, label: "CUSTOM" },
];

/** "40% cmETH + 30% sUSDe" → [{pct:"40%", symbol:"cmETH"}, ...] */
function parseAllocation(raw: string) {
  return raw.split("+").map((part) => {
    const m = part.trim().match(/^(\d+%)\s+(.+)$/);
    return m ? { pct: m[1], symbol: m[2] } : null;
  }).filter(Boolean) as { pct: string; symbol: string }[];
}

interface StrategyPickerProps {
  vaultAddress: `0x${string}`;
  onSaved?: () => void;
  onSelect?: (id: StrategyId) => void;
  saveLabel?: string;
}

export function StrategyPicker({ vaultAddress, onSaved, onSelect, saveLabel = "Save Strategy" }: StrategyPickerProps) {
  const {
    currentLevel,
    customAlloc,
    setStrategy,
    setCustomStrategy,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useRiskLevel(vaultAddress);

  const { strategies } = useStrategies();

  const [selected, setSelected] = useState<StrategyId>("LOW");
  const [low, setLow] = useState("33");
  const [med, setMed] = useState("34");
  const [high, setHigh] = useState("33");

  const busy = isPending || isConfirming;
  const preview = strategies.find((s) => s.id === selected) ?? null;
  const tokens = preview && selected !== "CUSTOM" ? parseAllocation(preview.allocation) : [];

  useEffect(() => {
    if (currentLevel !== undefined) {
      const opt = OPTIONS.find((o) => o.num === currentLevel);
      if (opt) setSelected(opt.id);
    }
  }, [currentLevel]);

  useEffect(() => {
    if (customAlloc) {
      setLow(String(Number(customAlloc[0]) / 100));
      setMed(String(Number(customAlloc[1]) / 100));
      setHigh(String(Number(customAlloc[2]) / 100));
    }
  }, [customAlloc]);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Strategy updated.");
      onSaved?.();
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = Number(low) + Number(med) + Number(high);
  const customValid = selected !== "CUSTOM" || total === 100;

  const save = async () => {
    try {
      if (selected === "CUSTOM") {
        const lowBps = Math.round(Number(low) * 100);
        const medBps = Math.round(Number(med) * 100);
        const highBps = 10_000 - lowBps - medBps;
        await setCustomStrategy(lowBps, medBps, highBps);
      } else {
        await setStrategy(selected);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch strategy");
    }
  };

  const label = isPending ? "Confirm in wallet..." : isConfirming ? "Saving..." : saveLabel;

  return (
    <div className="space-y-4">
      {/* Strategy selector */}
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const active = selected === opt.id;
          const isCurrent = currentLevel === opt.num;
          return (
            <button
              key={opt.id}
              onClick={() => { setSelected(opt.id); onSelect?.(opt.id); }}
              disabled={busy}
              className={cn(
                "rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[#1591DC] bg-[#EAF4FC] dark:bg-[#1591DC]/10"
                  : "border-[#DDE8F2] hover:border-[#5B7490] dark:border-white/10 dark:hover:border-white/30",
              )}
            >
              <span className="font-mono text-xs uppercase tracking-[0.06em] text-[#0C1A2B] dark:text-white">
                {opt.label}
              </span>
              {isCurrent && (
                <span className="ml-1.5 font-mono text-[0.6rem] uppercase text-[#16A34A]">
                  active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preview card */}
      {preview && selected !== "CUSTOM" && (
        <div className="space-y-3 rounded-xl border border-[#DDE8F2] bg-[#F7F9FC] p-4 dark:border-white/10 dark:bg-white/3">
          {/* APY */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
              Est. APY / yr
            </span>
            <span className="text-xl font-bold text-[#16A34A]">
              {preview.blendedApyPct != null
                ? `${preview.blendedApyPct}%`
                : preview.apyLabel}
            </span>
          </div>

          {/* Asset chips */}
          <div>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
              Assets
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tokens.map(({ pct, symbol }) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-1 rounded-full border border-[#DDE8F2] bg-white px-2.5 py-0.5 font-mono text-xs dark:border-white/10 dark:bg-white/5"
                >
                  <span className="text-[#1591DC] dark:text-[#4BB8FA]">{pct}</span>
                  <span className="text-[#0C1A2B] dark:text-white">{symbol}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Risk + tag row */}
          <div className="flex items-center justify-between border-t border-[#DDE8F2] pt-2.5 dark:border-white/10">
            <span className="text-xs text-[#5B7490] dark:text-white/45">{preview.tag}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.06em]",
                preview.risk === "Very Low" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                preview.risk === "Moderate" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                preview.risk === "High" && "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
              )}
            >
              {preview.risk}
            </span>
          </div>
        </div>
      )}

      {/* CUSTOM allocation inputs */}
      {selected === "CUSTOM" && (
        <div className="space-y-2 rounded-lg border border-[#DDE8F2] p-3 dark:border-white/10">
          <p className="text-xs text-[#5B7490] dark:text-white/45">
            Set your own allocation across the Low / Medium / High buckets.
          </p>
          {[
            { label: "Low", value: low, set: setLow },
            { label: "Medium", value: med, set: setMed },
            { label: "High", value: high, set: setHigh },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase text-[#5B7490] dark:text-white/45">
                {row.label}
              </span>
              <div className="flex w-28 items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={row.value}
                  onChange={(e) => row.set(e.target.value)}
                  disabled={busy}
                  className="font-mono"
                />
                <span className="text-xs text-[#5B7490]">%</span>
              </div>
            </div>
          ))}
          <p
            className={cn(
              "pt-1 font-mono text-xs",
              total === 100 ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            Total: {total}% {total === 100 ? "✓" : "— must equal 100%"}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button onClick={save} loading={busy} loadingLabel={label} disabled={!customValid} className="w-full">
        {saveLabel}
      </Button>
    </div>
  );
}
