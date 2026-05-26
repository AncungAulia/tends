"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Button } from "@/components/elements/Button";
import { AmountField } from "@/components/elements/AmountField";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useDeposit } from "@/hooks/useDeposit";
import { formatUSD } from "@/utils/format";

interface Props {
  vaultAddress: `0x${string}`;
  onDone: () => void;
  onSkip: () => void;
}

export function StepFirstDeposit({ vaultAddress, onDone, onSkip }: Props) {
  const { address } = useAccount();
  const { balance } = useUSDCBalance(address);
  const { deposit, isPending, isConfirming, isSuccess, error } = useDeposit();

  const [amount, setAmount] = useState("");

  const busy = isPending || isConfirming;
  const amountNum = Number(amount);
  const invalid = !amount || amountNum <= 0 || amountNum > Number(balance);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Deposit confirmed.");
      onDone();
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
    <div className="space-y-5">
      <div>
        <h2 className="font-sans text-xl font-bold tracking-tight text-[#0C1A2B] dark:text-white">
          Make Your First Deposit
        </h2>
        <p className="mt-2 text-sm text-[#5B7490] dark:text-white/45">
          Agent Hermes begins working as soon as funds are in your vault.
        </p>
      </div>

      <AmountField
        label="Amount"
        balanceLabel={`Balance: ${balance} USDC`}
        value={amount}
        onChange={setAmount}
        onMax={() => setAmount(balance)}
        usdPreview={amount ? formatUSD(amountNum) : undefined}
        disabled={busy}
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        onClick={handleDeposit}
        loading={busy}
        loadingLabel={label}
        disabled={invalid}
        className="w-full"
      >
        Deposit
      </Button>

      <button
        onClick={onSkip}
        className="w-full font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] hover:text-[#0C1A2B] dark:text-white/45 dark:hover:text-white"
      >
        Skip for now
      </button>
    </div>
  );
}
