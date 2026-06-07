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
                  ? "border-brand bg-brand-soft"
                  : "border-edge hover:border-dim",
              )}
            >
              <span className="font-mono text-xs uppercase tracking-[0.06em] text-ink">
                {opt.label}
              </span>
              {isCurrent && (
                <span className="ml-1.5 font-mono text-[0.6rem] uppercase text-pos">
                  active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preview card */}
      {preview && selected !== "CUSTOM" && (
        <div className="space-y-3 rounded-xl border border-edge bg-panel p-4">
          {/* APY */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-dim">
              Est. APY / yr
            </span>
            <span className="text-xl font-bold text-pos">
              {preview.blendedApyPct != null
                ? `${preview.blendedApyPct}%`
                : preview.apyLabel}
            </span>
          </div>

          {/* Asset chips */}
          <div>
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-dim">
              Assets
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tokens.map(({ pct, symbol }) => (
                <span
                  key={symbol}
                  className="inline-flex items-center gap-1 rounded-full border border-edge bg-card px-2.5 py-0.5 font-mono text-xs"
                >
                  <span className="text-brand">{pct}</span>
                  <span className="text-ink">{symbol}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Risk + tag row */}
          <div className="flex items-center justify-between border-t border-edge pt-2.5">
            <span className="text-xs text-dim">{preview.tag}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.06em]",
                preview.risk === "Very Low" && "bg-pos-soft text-pos",
                preview.risk === "Moderate" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                preview.risk === "High" && "bg-neg-soft text-neg",
              )}
            >
              {preview.risk}
            </span>
          </div>
        </div>
      )}

      {/* CUSTOM allocation inputs */}
      {selected === "CUSTOM" && (
        <div className="space-y-2 rounded-lg border border-edge p-3">
          <p className="text-xs text-dim">
            Set your own allocation across the Low / Medium / High buckets.
          </p>
          {[
            { label: "Low", value: low, set: setLow },
            { label: "Medium", value: med, set: setMed },
            { label: "High", value: high, set: setHigh },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase text-dim">
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
                <span className="text-xs text-dim">%</span>
              </div>
            </div>
          ))}
          <p
            className={cn(
              "pt-1 font-mono text-xs",
              total === 100 ? "text-pos" : "text-neg",
            )}
          >
            Total: {total}% {total === 100 ? "✓" : "— must equal 100%"}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-neg">{error}</p>}

      <Button onClick={save} loading={busy} loadingLabel={label} disabled={!customValid} className="w-full">
        {saveLabel}
      </Button>
    </div>
  );
}
