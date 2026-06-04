"use client";

import { useState, useEffect } from "react";
import { X, Check, Loader2, AlertCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import SlidingNumber from "@/components/preview/SlidingNumber";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useDeposit } from "@/hooks/useDeposit";
import { useWithdraw } from "@/hooks/useWithdraw";
import { useVaultStore } from "@/hooks/useVaultStore";
import { useVaultHoldings } from "@/hooks/useVaultHoldings";
import { TokenIcon, TOKEN_COLOR } from "@/components/elements/TokenIcon";
import { motion, AnimatePresence } from "motion/react";

/* ──────────────────────────────────────────────────────────
   Deposit / Withdraw modals — real on-chain balances + txs.
   ────────────────────────────────────────────────────────── */

const USD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Custom range slider (consistent cross-browser colors) ───────────────────
// Native `accentColor` causes Chrome to derive a near-black filled track for
// certain hues (e.g. teal #15A6B0). Custom track + invisible native input
// keeps full drag/keyboard behavior while rendering the exact token color.

function TokenSlider({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="relative flex h-5 w-full items-center">
      {/* unfilled track */}
      <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-[#E8EAEC]" />
      {/* filled track */}
      <div
        className="pointer-events-none absolute left-0 h-1.5 rounded-full"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
      {/* thumb */}
      <div
        className="pointer-events-none absolute h-[14px] w-[14px] rounded-full border-2 border-white shadow"
        style={{
          left: `calc(${value}% - ${(value / 100) * 14}px)`,
          backgroundColor: color,
        }}
      />
      {/* invisible native input for interaction */}
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}

// ─── Shared modal shell ──────────────────────────────────

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-[#0C1A2B]/25 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} />
      <div className="relative w-full max-w-md rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-6 shadow-xl shadow-[#0C1A2B]/10" style={{ animation: "fadeIn .2s ease" }}>
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
      <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AmountField({ amount, setAmount, max, quick }: { amount: string; setAmount: (v: string) => void; max: number; quick: number[] }) {
  const onChange = (v: string) => { if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v); };
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
        <button onClick={() => setAmount(USD(max))} className="shrink-0 rounded-md bg-[#F7F9FC] px-2.5 py-1 text-xs font-semibold text-[#1591DC] transition-colors hover:bg-[#EAF4FC]">
          MAX
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setAmount(String(q))} className="rounded-full border border-[#E8EAEC] px-2.5 py-1 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC]">
            ${q.toLocaleString("en-US")}
          </button>
        ))}
      </div>
    </>
  );
}

function Done({ msg, sub, onClose }: { msg: string; sub: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center" style={{ animation: "fadeIn .25s ease" }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
        <Check className="h-6 w-6 text-green-600" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#0C1A2B]">{msg}</p>
      <p className="mt-0.5 text-xs text-[#5B7490]">{sub}</p>
      <button onClick={onClose} className="mt-5 w-full rounded-full bg-[#F7F9FC] px-4 py-2.5 text-sm font-medium text-[#0C1A2B] transition-colors hover:bg-[#EAF4FC]">
        Done
      </button>
    </div>
  );
}

function SubmitButton({ verb, amount, busy, disabled, onClick }: { verb: string; amount: number; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
      {busy ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> Working...</>
      ) : amount > 0 ? (
        <span className="flex items-center gap-1">
          <span>{verb}</span>
          <span className="flex items-center">$<SlidingNumber className="inline-flex" number={amount} decimalPlaces={2} /></span>
        </span>
      ) : verb}
    </button>
  );
}

// ─── Deposit ─────────────────────────────────────────────

export function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useAccount();
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { balance, isLoading: balLoading, refetch: refetchBal } = useUSDCBalance(address);
  const { deposit, state, error, reset, isSuccess } = useDeposit();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const walletBalance = parseFloat(balance) || 0;
  const num = parseFloat(amount.replace(/,/g, "")) || 0;
  const valid = num > 0 && num <= walletBalance && !!vaultAddress && !!address;
  const busy = state === "pending" || state === "confirming";

  function close() {
    onClose();
    setAmount("");
    reset();
  }

  async function submit() {
    if (!valid || !vaultAddress || !address) return;
    try {
      await deposit(vaultAddress, address, num);
      await Promise.all([refetchBal(), queryClient.invalidateQueries()]);
    } catch {
      // error already set in hook
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : close}>
      <Head title="Deposit" sub="Add funds. Your agent will allocate them for you." onClose={busy ? () => {} : close} />
      {isSuccess ? (
        <Done
          msg={`Deposited $${USD(num)}`}
          sub="Your agent is allocating it across your strategy now."
          onClose={close}
        />
      ) : (
        <>
          <AmountField amount={amount} setAmount={setAmount} max={walletBalance} quick={[100, 500, 1000]} />
          <p className="mt-2 text-xs text-[#94A3B8]">
            Wallet balance:{" "}
            {balLoading ? "…" : `$${USD(walletBalance)} USDC`}
          </p>
          {num > walletBalance && walletBalance > 0 && (
            <p className="mt-1 text-xs text-red-500">Exceeds your wallet balance.</p>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <SubmitButton verb="Deposit" amount={num} busy={busy} disabled={!valid} onClick={submit} />
        </>
      )}
    </Modal>
  );
}

// ─── Withdraw ────────────────────────────────────────────

export function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useAccount();
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { totalAssetsUSDC } = usePortfolio(vaultAddress, address);
  const { holdings } = useVaultHoldings(vaultAddress as `0x${string}` | undefined);
  const { withdraw, state, error, reset, isSuccess } = useWithdraw();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [rawInput, setRawInput] = useState("");
  const [sellPct, setSellPct] = useState<Record<string, number>>({});

  const vaultBalance = totalAssetsUSDC;
  const parsedInput = parseFloat(rawInput.replace(/,/g, "")) || 0;
  const num = mode === "percent" ? (vaultBalance * parsedInput / 100) : parsedInput;
  const valid = num > 0 && num <= vaultBalance && !!vaultAddress && !!address;
  const busy = state === "pending" || state === "confirming";

  const usdcHolding = holdings.find((h) => h.symbol === "USDC");
  const nonUsdcHoldings = holdings.filter((h) => h.symbol !== "USDC" && (h.valueUSD ?? 0) > 0.01);
  const isMaxWithdraw = num > 0 && vaultBalance > 0 && Math.abs(num - vaultBalance) < 0.01;
  const showBreakdown = num > 0 && !isMaxWithdraw && nonUsdcHoldings.length > 0;

  // Sync sliders to proportional whenever the USD amount or holdings list changes
  const nonUsdcKey = nonUsdcHoldings.map((h) => h.symbol).join(",");
  useEffect(() => {
    if (!vaultBalance || !nonUsdcHoldings.length) return;
    const pct = Math.min(100, Math.round((num / vaultBalance) * 100)) || 0;
    const next: Record<string, number> = {};
    for (const h of nonUsdcHoldings) next[h.symbol] = pct;
    setSellPct(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num, nonUsdcKey]);

  // Estimated proceeds based on slider configuration
  const usdcAvail = Math.min(usdcHolding?.valueUSD ?? 0, num);
  const tokenProceeds = nonUsdcHoldings.reduce(
    (sum, h) => sum + (h.valueUSD ?? 0) * (sellPct[h.symbol] ?? 0) / 100,
    0,
  );
  const estimatedProceeds = usdcAvail + tokenProceeds;
  const proceedsMet = num <= 0 || estimatedProceeds >= num * 0.98;

  function handleRawInput(v: string) {
    if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
    if (mode === "percent") {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 100) return;
    }
    setRawInput(v);
  }

  function switchMode(m: "amount" | "percent") {
    setMode(m);
    setRawInput("");
  }

  function setMax() {
    setRawInput(mode === "amount" ? USD(vaultBalance) : "100");
  }

  function close() {
    onClose();
    setRawInput("");
    setMode("amount");
    setSellPct({});
    reset();
  }

  async function submit() {
    if (!valid || !vaultAddress || !address) return;
    try {
      await withdraw(vaultAddress, address, num);
      await queryClient.invalidateQueries();
    } catch {
      // error already set in hook
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : close}>
      <Head
        title="Withdraw"
        sub="Your positions will be sold to USDC, then sent to your wallet."
        onClose={busy ? () => {} : close}
      />
      {isSuccess ? (
        <Done
          msg={`Withdrew $${USD(num)}`}
          sub="Sent to your wallet. Your allocation stays balanced."
          onClose={close}
        />
      ) : (
        <>
          {/* ── Amount / Percent toggle + input ───────────── */}
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-[#5B7490]">Amount</p>
            <div className="flex items-center rounded-full border border-[#E8EAEC] bg-[#F7F9FC] p-0.5">
              {(["amount", "percent"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`relative rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                    mode === m ? "text-white" : "text-[#5B7490] hover:text-[#0C1A2B]"
                  }`}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="withdraw-toggle-pill"
                      className="absolute inset-0 rounded-full bg-[#1591DC] shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{m === "amount" ? "$" : "%"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E8EAEC] bg-white px-4 py-3 transition-colors focus-within:border-[#1591DC] focus-within:ring-1 focus-within:ring-[#1591DC]/20">
            <span className="text-2xl font-semibold text-[#94A3B8]">
              {mode === "amount" ? "$" : "%"}
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={rawInput}
              onChange={(e) => handleRawInput(e.target.value)}
              placeholder="0.00"
              className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-[-0.02em] text-[#0C1A2B] outline-none placeholder:text-[#CBD5E1]"
            />
            <button
              onClick={setMax}
              className="shrink-0 rounded-md bg-[#F7F9FC] px-2.5 py-1 text-xs font-semibold text-[#1591DC] transition-colors hover:bg-[#EAF4FC]"
            >
              MAX
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1.5">
              {(mode === "amount" ? [100, 500, 1000] : [25, 50, 75]).map((q) => (
                <button
                  key={q}
                  onClick={() => setRawInput(String(q))}
                  className="rounded-full border border-[#E8EAEC] px-2.5 py-1 text-xs font-medium text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC]"
                >
                  {mode === "amount" ? `$${q.toLocaleString("en-US")}` : `${q}%`}
                </button>
              ))}
            </div>
            {mode === "percent" && parsedInput > 0 && (
              <span className="text-xs tabular-nums text-[#94A3B8]">≈ ${USD(num)}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[#94A3B8]">Available: ${USD(vaultBalance)}</p>

          {/* ── Partial-withdraw breakdown ─────────────────── */}
          <AnimatePresence initial={false}>
            {showBreakdown && (
              <motion.div
                key="breakdown"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ overflow: "hidden" }}
              >
                <div className="rounded-xl border border-[#E8EAEC] p-3">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5B7490]">
                    Assets to sell
                  </p>

                  {/* USDC is used directly — no swap */}
                  {usdcHolding && (usdcHolding.valueUSD ?? 0) > 0.01 && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08, duration: 0.2 }}
                      className="mb-2.5 flex items-center gap-2.5"
                    >
                      <TokenIcon sym="USDC" size={22} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[#0C1A2B]">USDC</span>
                          <span className="text-xs text-[#5B7490]">~${USD(usdcAvail)}</span>
                        </div>
                        <p className="text-[10px] text-[#94A3B8]">Available directly · no swap needed</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Non-USDC holdings with staggered sliders */}
                  <div className="space-y-3">
                    {nonUsdcHoldings.map((h, i) => {
                      const pct = sellPct[h.symbol] ?? 0;
                      const proceeds = (h.valueUSD ?? 0) * pct / 100;
                      const accentColor = TOKEN_COLOR[h.symbol] ?? "#1591DC";
                      return (
                        <motion.div
                          key={h.symbol}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.08 + i * 0.055, duration: 0.2, ease: "easeOut" }}
                        >
                          <div className="flex items-center gap-2.5">
                            <TokenIcon sym={h.symbol} size={22} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-[#0C1A2B]">{h.symbol}</span>
                                <span className="text-xs tabular-nums text-[#5B7490]">~${USD(proceeds)}</span>
                              </div>
                              <div className="mt-1.5">
                                <TokenSlider
                                  value={pct}
                                  onChange={(v) => setSellPct((prev) => ({ ...prev, [h.symbol]: v }))}
                                  color={accentColor}
                                />
                              </div>
                              <div className="mt-0.5 flex justify-between text-[10px] text-[#94A3B8]">
                                <span style={{ color: pct > 0 ? accentColor : undefined }}>{pct}% sold</span>
                                <span>${USD(h.valueUSD ?? 0)} total</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Proceeds summary — fades in last */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.08 + nonUsdcHoldings.length * 0.055 + 0.05, duration: 0.2 }}
                    className={`mt-3 flex items-center justify-between rounded-lg px-2.5 py-2 ${
                      proceedsMet ? "bg-[#F0FDF4]" : "bg-red-50"
                    }`}
                  >
                    <span className={`text-xs ${proceedsMet ? "text-green-700" : "text-red-600"}`}>
                      Estimated proceeds
                    </span>
                    <span className={`text-xs font-semibold tabular-nums ${proceedsMet ? "text-green-700" : "text-red-600"}`}>
                      ~${USD(estimatedProceeds)}
                      {!proceedsMet && " · below target"}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wallet destination */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F7F9FC] px-3 py-2 text-xs">
            <span className="text-[#5B7490]">To your wallet</span>
            <span className="font-mono text-[#0C1A2B]">
              {address ? truncateAddr(address) : "—"}
            </span>
          </div>

          {num > vaultBalance && vaultBalance > 0 && (
            <p className="mt-1 text-xs text-red-500">Exceeds your available balance.</p>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Disclaimer */}
          {isMaxWithdraw || !showBreakdown ? (
            <p className="mt-3 text-xs leading-relaxed text-[#5B7490]">
              All holdings are liquidated to USDC in the same transaction. Max slippage: 1%.
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-relaxed text-[#94A3B8]">
              Sliders reflect proportional liquidation. Exact execution is managed by your agent.
            </p>
          )}

          <SubmitButton verb="Withdraw" amount={num} busy={busy} disabled={!valid} onClick={submit} />
        </>
      )}
    </Modal>
  );
}
