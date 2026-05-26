"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/elements/Button";
import { Input } from "@/components/elements/Input";
import { useRiskLevel, type StrategyId } from "@/hooks/useRiskLevel";
import { cn } from "@/utils/cn";

const OPTIONS: { id: StrategyId; num: number; label: string; desc: string }[] = [
  { id: "LOW", num: 0, label: "LOW", desc: "Conservative bonds and stablecoin yield. Minimal drawdown — suited for capital preservation." },
  { id: "MEDIUM", num: 1, label: "MEDIUM", desc: "A balanced blend of bonds, commodities, and funds." },
  { id: "HIGH", num: 2, label: "HIGH", desc: "Stocks and commodities. Higher potential return, higher risk." },
  { id: "CUSTOM", num: 3, label: "CUSTOM", desc: "Set your own allocation across the low / medium / high buckets." },
];

interface StrategyPickerProps {
  vaultAddress: `0x${string}`;
  onSaved?: () => void;
  saveLabel?: string;
}

export function StrategyPicker({ vaultAddress, onSaved, saveLabel = "Save Strategy" }: StrategyPickerProps) {
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

  const [selected, setSelected] = useState<StrategyId>("LOW");
  const [low, setLow] = useState("33");
  const [med, setMed] = useState("34");
  const [high, setHigh] = useState("33");

  const busy = isPending || isConfirming;

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
        const highBps = 10_000 - lowBps - medBps; // guarantee exact sum
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
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const active = selected === opt.id;
          const isCurrent = currentLevel === opt.num;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
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

      <p className="text-sm text-[#5B7490] dark:text-white/45">
        {OPTIONS.find((o) => o.id === selected)?.desc}
      </p>

      {selected === "CUSTOM" && (
        <div className="space-y-2 rounded-lg border border-[#DDE8F2] p-3 dark:border-white/10">
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
