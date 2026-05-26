"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { Button } from "@/components/elements/Button";
import { AmountField } from "@/components/elements/AmountField";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useWithdraw } from "@/hooks/useWithdraw";
import { formatUSD } from "@/utils/format";

interface WithdrawProps {
  open: boolean;
  onClose: () => void;
  vaultAddress: `0x${string}`;
  onSuccess?: () => void;
}

export function Withdraw({ open, onClose, vaultAddress, onSuccess }: WithdrawProps) {
  const { address } = useAccount();
  const { totalAssetsUSDC } = usePortfolio(vaultAddress, address);
  const { withdraw, isPending, isConfirming, isSuccess, error, reset } = useWithdraw();

  const [amount, setAmount] = useState("");

  const busy = isPending || isConfirming;
  const amountNum = Number(amount);
  const invalid = !amount || amountNum <= 0 || amountNum > totalAssetsUSDC;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Withdrawal confirmed.");
      setAmount("");
      reset();
      onSuccess?.();
      onClose();
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = isPending
    ? "Confirm in wallet..."
    : isConfirming
      ? "Processing..."
      : "Withdraw";

  const handleWithdraw = async () => {
    if (!address) return;
    try {
      await withdraw(vaultAddress, address, amountNum);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Withdraw USDC" locked={busy}>
      <div className="space-y-4">
        <AmountField
          label="Amount"
          balanceLabel={`Available: ${formatUSD(totalAssetsUSDC)}`}
          value={amount}
          onChange={setAmount}
          onMax={() => setAmount(totalAssetsUSDC.toFixed(2))}
          usdPreview={amount ? formatUSD(amountNum) : undefined}
          disabled={busy}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          onClick={handleWithdraw}
          loading={busy}
          loadingLabel={label}
          disabled={invalid}
          className="w-full"
        >
          Withdraw
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
