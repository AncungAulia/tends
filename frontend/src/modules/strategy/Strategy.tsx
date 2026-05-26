"use client";

import { ResponsiveSheet } from "@/components/elements/ResponsiveSheet";
import { StrategyPicker } from "./component/StrategyPicker";

interface StrategyProps {
  open: boolean;
  onClose: () => void;
  vaultAddress: `0x${string}`;
  onSuccess?: () => void;
}

export function Strategy({ open, onClose, vaultAddress, onSuccess }: StrategyProps) {
  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Change Strategy">
      <StrategyPicker
        vaultAddress={vaultAddress}
        onSaved={() => {
          onSuccess?.();
          onClose();
        }}
      />
    </ResponsiveSheet>
  );
}
