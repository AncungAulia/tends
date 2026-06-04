"use client";

import { useState, useEffect } from "react";
import { X, Check, Loader2 } from "lucide-react";
import SlidingNumber from "@/components/preview/SlidingNumber";

/* ──────────────────────────────────────────────────────────
   Deposit / Withdraw overlay modals — Tends
   Centered dialog, amount-based, agent-aware copy.
   ────────────────────────────────────────────────────────── */

const WALLET_BALANCE = 2500;
const VAULT_BALANCE = 12430.5;
const USD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Shared centered modal ──────────────────────────────────

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#0C1A2B]/25 backdrop-blur-[2px]"
        style={{ animation: "fadeIn .2s ease" }}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-6 shadow-xl shadow-[#0C1A2B]/10"
        style={{ animation: "fadeIn .2s ease" }}
      >
        {children}
      </div>
    </div>
  );
}

function Head({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#0C1A2B]">{title}</h2>
        <p className="mt-0.5 text-sm text-[#5B7490]">{sub}</p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AmountField({
  amount,
  setAmount,
  max,
  quick,
}: {
  amount: string;
  setAmount: (v: string) => void;
  max: number;
  quick: number[];
}) {
  const onChange = (v: string) => {
    if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v);
  };
  return (
    <>
      <p className="mb-1.5 text-xs font-medium text-[#5B7490]">Amount</p>
      <div className="flex items-center gap-2 rounded-xl border border-[#E8EAEC] bg-white px-4 py-3 transition-colors focus-within:border-[#1591DC] focus-within:ring-1 focus-within:ring-[#1591DC]/20">
        <span className="text-2xl font-semibold text-[#94A3B8]">$</span>
        <input
          autoFocus
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-[-0.02em] text-[#0C1A2B] outline-none placeholder:text-[#CBD5E1]"
        />
        <button
          onClick={() => setAmount(String(max))}
          className="shrink-0 rounded-md bg-[#F7F9FC] px-2.5 py-1 text-xs font-semibold text-[#1591DC] transition-colors hover:bg-[#EAF4FC]"
        >
          MAX
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(String(q))}
            className="rounded-full border border-[#E8EAEC] px-2.5 py-1 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC]"
          >
            ${q.toLocaleString("en-US")}
          </button>
        ))}
      </div>
    </>
  );
}

function Done({ msg, sub, onClose }: { msg: string; sub: string; onClose: () => void }) {
  return (
    <div
      className="flex flex-col items-center py-4 text-center"
      style={{ animation: "fadeIn .25s ease" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
        <Check className="h-6 w-6 text-green-600" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0C1A2B]">{msg}</p>
      <p className="mt-0.5 text-xs text-[#5B7490]">{sub}</p>
      <button
        onClick={onClose}
        className="mt-5 w-full rounded-full bg-[#F7F9FC] px-4 py-2.5 text-sm font-medium text-[#0C1A2B] transition-colors hover:bg-[#EAF4FC]"
      >
        Done
      </button>
    </div>
  );
}

function SubmitButton({
  verb,
  amount,
  executing,
  disabled,
  onClick,
}: {
  verb: string;
  amount: number;
  executing: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {executing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Working...
        </>
      ) : amount > 0 ? (
        <span className="flex items-center gap-1">
          <span>{verb}</span>
          <span className="flex items-center">
            $<SlidingNumber className="inline-flex" number={amount} decimalPlaces={2} />
          </span>
        </span>
      ) : (
        verb
      )}
    </button>
  );
}

// ─── Deposit ────────────────────────────────────────────────

export function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<"input" | "executing" | "done">("input");
  const num = parseFloat(amount) || 0;
  const valid = num > 0 && num <= WALLET_BALANCE;

  function close() {
    onClose();
    setAmount("");
    setState("input");
  }
  function submit() {
    if (!valid) return;
    setState("executing");
    setTimeout(() => setState("done"), 1800);
  }

  return (
    <Modal open={open} onClose={close}>
      <Head
        title="Deposit"
        sub="Add funds. Your agent will allocate them for you."
        onClose={close}
      />
      {state === "done" ? (
        <Done
          msg={`Deposited $${USD(num)}`}
          sub="Your agent is allocating it across your strategy now."
          onClose={close}
        />
      ) : (
        <>
          <AmountField
            amount={amount}
            setAmount={setAmount}
            max={WALLET_BALANCE}
            quick={[100, 500, 1000]}
          />
          <p className="mt-2 text-xs text-[#94A3B8]">
            Wallet balance: ${USD(WALLET_BALANCE)} USDC
          </p>
          {num > WALLET_BALANCE && (
            <p className="mt-1 text-xs text-red-500">Exceeds your wallet balance.</p>
          )}
          <SubmitButton
            verb="Deposit"
            amount={num}
            executing={state === "executing"}
            disabled={!valid || state === "executing"}
            onClick={submit}
          />
        </>
      )}
    </Modal>
  );
}

// ─── Withdraw ───────────────────────────────────────────────

export function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<"input" | "executing" | "done">("input");
  const num = parseFloat(amount) || 0;
  const valid = num > 0 && num <= VAULT_BALANCE;

  function close() {
    onClose();
    setAmount("");
    setState("input");
  }
  function submit() {
    if (!valid) return;
    setState("executing");
    setTimeout(() => setState("done"), 1800);
  }

  return (
    <Modal open={open} onClose={close}>
      <Head title="Withdraw" sub="Send funds back to your wallet." onClose={close} />
      {state === "done" ? (
        <Done
          msg={`Withdrew $${USD(num)}`}
          sub="Sent to your wallet. Your allocation stays balanced."
          onClose={close}
        />
      ) : (
        <>
          <AmountField
            amount={amount}
            setAmount={setAmount}
            max={VAULT_BALANCE}
            quick={[100, 500, 1000]}
          />
          <p className="mt-2 text-xs text-[#94A3B8]">Available: ${USD(VAULT_BALANCE)}</p>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F7F9FC] px-3 py-2 text-xs">
            <span className="text-[#5B7490]">To your wallet</span>
            <span className="font-mono text-[#0C1A2B]">0x3f4a...c82b</span>
          </div>
          {num > VAULT_BALANCE && (
            <p className="mt-1 text-xs text-red-500">Exceeds your available balance.</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-[#5B7490]">
            Your agent sells a little of each asset to fund this, keeping your mix balanced.
          </p>
          <SubmitButton
            verb="Withdraw"
            amount={num}
            executing={state === "executing"}
            disabled={!valid || state === "executing"}
            onClick={submit}
          />
        </>
      )}
    </Modal>
  );
}
