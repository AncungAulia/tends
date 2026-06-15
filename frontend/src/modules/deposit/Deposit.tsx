"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { Button } from "@/components/elements/Button";
import { AmountField } from "@/components/elements/AmountField";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useDeposit } from "@/hooks/useDeposit";
import { formatUSD } from "@/utils/format";

interface DepositProps {
  open: boolean;
  onClose: () => void;
  vaultAddress: `0x${string}`;
  paused?: boolean;
  onSuccess?: () => void;
}

export function Deposit({ open, onClose, vaultAddress, paused, onSuccess }: DepositProps) {
  const { address } = useAccount();
  const { balance, balanceRaw } = useUSDCBalance(address);
  const { deposit, isPending, isConfirming, isSuccess, error, reset } = useDeposit();

  const [amount, setAmount] = useState("");

  const busy = isPending || isConfirming;
  const amountNum = Number(amount);
  const invalid = !amount || amountNum <= 0 || amountNum > Number(balance);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Deposit confirmed.");
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
      : "Deposit";

  const handleDeposit = async () => {
    if (!address) return;
    try {
      await deposit(vaultAddress, address, amountNum);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Deposit USDC" locked={busy}>
      {paused ? (
        <p className="rounded-lg border border-yellow-300/60 bg-yellow-50 p-3 text-sm text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-950/30 dark:text-yellow-400">
          Vault is paused — deposits are temporarily unavailable.
        </p>
      ) : (
        <div className="space-y-4">
          <AmountField
            label="Amount"
            balanceLabel={`Balance: ${balance} USDC`}
            value={amount}
            onChange={setAmount}
            onMax={() => setAmount(balance)}
            usdPreview={amount ? formatUSD(amountNum) : undefined}
            disabled={busy}
          />

          {error && <p className="text-sm text-neg">{error}</p>}

          <Button
            onClick={handleDeposit}
            loading={busy}
            loadingLabel={label}
            disabled={invalid || balanceRaw === 0n}
            className="w-full"
          >
            Deposit
          </Button>

          <p className="text-center font-mono text-[0.65rem] uppercase tracking-[0.06em] text-dim">
            Signed via your embedded wallet
          </p>
        </div>
      )}
    </ResponsiveDialog>
  );
}
