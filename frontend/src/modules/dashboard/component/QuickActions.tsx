"use client";

import { Button } from "@/components/elements/Button";

interface QuickActionsProps {
  paused: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function QuickActions({ paused, onDeposit, onWithdraw }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <span title={paused ? "Deposits unavailable — vault paused" : undefined}>
        <Button onClick={onDeposit} disabled={paused}>
          Deposit
        </Button>
      </span>
      <Button variant="secondary" onClick={onWithdraw}>
        Withdraw
      </Button>
    </div>
  );
}
