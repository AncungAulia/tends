"use client";

import { Input } from "./Input";

interface AmountFieldProps {
  label: string;
  balanceLabel?: string;
  value: string;
  onChange: (value: string) => void;
  onMax?: () => void;
  usdPreview?: string;
  disabled?: boolean;
}

export function AmountField({
  label,
  balanceLabel,
  value,
  onChange,
  onMax,
  usdPreview,
  disabled,
}: AmountFieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
          {label}
        </span>
        {balanceLabel && (
          <span className="font-mono text-xs text-[#5B7490] dark:text-white/45">
            {balanceLabel}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="0.00"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
        />
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            disabled={disabled}
            className="shrink-0 rounded-lg border border-[#DDE8F2] px-3 font-mono text-xs uppercase text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC] disabled:opacity-40 dark:border-white/10 dark:text-white/45"
          >
            Max
          </button>
        )}
      </div>
      {usdPreview && (
        <p className="mt-1.5 font-mono text-xs text-[#5B7490] dark:text-white/45">
          ≈ {usdPreview}
        </p>
      )}
    </div>
  );
}
