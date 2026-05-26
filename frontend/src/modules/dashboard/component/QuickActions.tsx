"use client";

import { Button } from "@/components/elements/Button";

interface QuickActionsProps {
  paused: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  onStrategy: () => void;
}

export function QuickActions({ paused, onDeposit, onWithdraw, onStrategy }: QuickActionsProps) {
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
      <Button variant="secondary" onClick={onStrategy}>
        Strategy
      </Button>
    </div>
  );
}
