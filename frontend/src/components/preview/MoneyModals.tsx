"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
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
import { Drawer as Vaul } from "vaul";
import { useIsMobile } from "@/hooks/useIsMobile";

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
      <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-edge" />
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
  const isMobile = useIsMobile();

  // desktop centered modal handles its own esc + scroll-lock; on mobile Vaul does
  useEffect(() => {
    if (!open || isMobile) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose, isMobile]);

  // mobile: Vaul bottom sheet — draggable, scroll-locked, repositions inputs
  if (isMobile) {
    return (
      <Vaul.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Vaul.Portal>
          <Vaul.Overlay className="fixed inset-0 z-50 bg-tip/25 backdrop-blur-[2px]" />
          <Vaul.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-edge bg-card outline-none"
          >
            <Vaul.Title className="sr-only">Manage funds</Vaul.Title>
            {/* grabber */}
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-edge" />
            <div className="flex-1 overflow-y-auto px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
              {children}
            </div>
          </Vaul.Content>
        </Vaul.Portal>
      </Vaul.Root>
    );
  }

  // desktop: centered modal
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-tip/25 backdrop-blur-[2px]" style={{ animation: "fadeIn .2s ease" }} />
      <div className="relative w-full max-w-md rounded-2xl border-[1.25px] border-edge bg-card p-6 shadow-xl shadow-[#0C1A2B]/10" style={{ animation: "fadeIn .2s ease" }}>
        {children}
      </div>
    </div>
  );
}

function Head({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-dim">{sub}</p>
      </div>
      <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge text-dim transition-colors hover:border-dim hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AmountField({ amount, setAmount, max, quick }: { amount: string; setAmount: (v: string) => void; max: number; quick: number[] }) {
  const onChange = (v: string) => { if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v); };
  return (
    <>
      <p className="mb-1.5 text-xs font-medium text-dim">Amount</p>
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-4 py-3 transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-[#1591DC]/20">
        <span className="text-2xl font-semibold text-faint">$</span>
        <input
          autoFocus
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-faint"
        />
        <button onClick={() => setAmount(USD(max))} className="shrink-0 rounded-md bg-panel px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft">
          MAX
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => setAmount(String(q))} className="rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-dim transition-colors hover:border-brand hover:text-brand">
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pos-soft">
        <Check className="h-6 w-6 text-pos" />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{msg}</p>
      <p className="mt-0.5 text-xs text-dim">{sub}</p>
      <button onClick={onClose} className="mt-5 w-full rounded-full bg-panel px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brand-soft">
        Done
      </button>
    </div>
  );
}

function SubmitButton({ verb, amount, busy, disabled, onClick }: { verb: string; amount: number; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40">
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
          <p className="mt-2 text-xs text-faint">
            Wallet balance:{" "}
            {balLoading ? "…" : `$${USD(walletBalance)} USDC`}
          </p>
          {num > walletBalance && walletBalance > 0 && (
            <p className="mt-1 text-xs text-neg">Exceeds your wallet balance.</p>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-neg-soft px-3 py-2 text-xs text-neg">
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

/**
 * Post-submit progress screen. ERC-4626 redeem is atomic (one tx that
 * liquidates every position to USDC AND transfers USDC to the user), so
 * receipt confirmation is the single gate for "fully done". We split it
 * into two visual steps purely for storytelling — both flip green at once
 * when the receipt comes back.
 */
function WithdrawProgress({
  amount,
  hash,
  onClose,
}: {
  amount: number;
  hash: `0x${string}` | undefined;
  onClose: () => void;
}) {
  // `isSuccess` from wagmi only means "receipt was fetched", NOT "tx succeeded".
  // For a reverted tx the receipt comes back fine with status="reverted" — we
  // must read `data.status` to know the real outcome.
  const { data: receipt, isError: receiptFetchError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });
  const confirmed = receipt?.status === "success";
  const reverted = receipt?.status === "reverted" || receiptFetchError;
  const finished = confirmed || reverted;

  return (
    <div className="flex flex-col items-center py-2 text-center" style={{ animation: "fadeIn .25s ease" }}>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
          reverted ? "bg-neg-soft" : confirmed ? "bg-pos-soft" : "bg-brand-soft"
        }`}
      >
        {reverted ? (
          <AlertCircle className="h-6 w-6 text-neg" />
        ) : confirmed ? (
          <Check className="h-6 w-6 text-pos" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        )}
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">
        {reverted
          ? "Withdrawal failed on-chain"
          : confirmed
            ? `Withdrew $${USD(amount)}`
            : "Processing your withdrawal..."}
      </p>
      <p className="mt-0.5 text-xs text-dim">
        {reverted
          ? "The transaction was rejected by the vault. Try again in a moment."
          : confirmed
            ? "USDC is in your wallet."
            : "Hang tight — this usually takes 10 to 30 seconds."}
      </p>

      <div className="mt-5 w-full space-y-2 rounded-xl border border-edge p-3 text-left">
        <ProgressStep done={confirmed} failed={reverted} label="Swapping all positions to USDC" />
        <ProgressStep done={confirmed} failed={reverted} label="Sending USDC to your wallet" />
      </div>

      <button
        onClick={onClose}
        disabled={!finished}
        className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
          finished
            ? "bg-panel text-ink hover:bg-brand-soft"
            : "cursor-not-allowed bg-panel text-faint opacity-50"
        }`}
      >
        {reverted ? "Close" : "Done"}
      </button>
    </div>
  );
}

function ProgressStep({
  done,
  failed,
  label,
}: {
  done: boolean;
  failed?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
          failed ? "bg-neg-soft" : done ? "bg-pos-soft" : "bg-panel"
        }`}
      >
        {failed ? (
          <X className="h-3 w-3 text-neg" />
        ) : done ? (
          <Check className="h-3 w-3 text-pos" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-dim" />
        )}
      </div>
      <span className={`text-xs ${failed ? "text-neg" : done ? "text-ink" : "text-dim"}`}>
        {label}
      </span>
    </div>
  );
}

export function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address } = useAccount();
  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { totalAssetsUSDC } = usePortfolio(vaultAddress, address);
  const { holdings } = useVaultHoldings(vaultAddress as `0x${string}` | undefined);
  const { withdraw, state, error, reset, isSuccess, hashes } = useWithdraw();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [rawInput, setRawInput] = useState("");
  const [sellPct, setSellPct] = useState<Record<string, number>>({});
  // Frozen at submit so the progress screen keeps showing the same amount
  // even if vault holdings / sliders shift while waiting for the receipt.
  const [submittedAmount, setSubmittedAmount] = useState(0);
  // Assets-to-sell pagination — keeps the modal compact when the vault holds
  // many tokens (e.g. HIGH preset can liquidate 10+ positions).
  const [assetPage, setAssetPage] = useState(0);
  const ASSETS_PER_PAGE = 3;
  // tracks whether the last edit came from the amount field or a slider, so the
  // two-way sync below doesn't fight itself
  const editSrc = useRef<"amount" | "slider">("amount");

  const vaultBalance = totalAssetsUSDC;
  const parsedInput = parseFloat(rawInput.replace(/,/g, "")) || 0;
  const num = mode === "percent" ? (vaultBalance * parsedInput / 100) : parsedInput;
  const valid = num > 0 && num <= vaultBalance && !!vaultAddress && !!address;
  const busy = state === "pending" || state === "confirming";

  const usdcHolding = holdings.find((h) => h.symbol === "USDC");
  const nonUsdcHoldings = holdings.filter((h) => h.symbol !== "USDC" && (h.valueUSD ?? 0) > 0.01);
  const isMaxWithdraw = num > 0 && vaultBalance > 0 && Math.abs(num - vaultBalance) < 0.01;
  const showBreakdown = num > 0 && !isMaxWithdraw && nonUsdcHoldings.length > 0;

  // Sliders still operate on the full list (proceeds + proportional math need
  // every holding). Pagination only narrows what's rendered.
  const totalAssetPages = Math.max(1, Math.ceil(nonUsdcHoldings.length / ASSETS_PER_PAGE));
  const pagedHoldings = nonUsdcHoldings.slice(
    assetPage * ASSETS_PER_PAGE,
    assetPage * ASSETS_PER_PAGE + ASSETS_PER_PAGE,
  );
  // Clamp the active page when the holdings list shrinks (e.g. dust gets dropped
  // mid-session) so the page indicator never points past the last page.
  useEffect(() => {
    if (assetPage >= totalAssetPages) setAssetPage(totalAssetPages - 1);
  }, [totalAssetPages, assetPage]);

  // Sync sliders to proportional whenever the USD amount or holdings list changes
  const nonUsdcKey = nonUsdcHoldings.map((h) => h.symbol).join(",");
  useEffect(() => {
    // skip when the change came from a slider — don't flatten the user's
    // per-token tweak back into a uniform proportional split
    if (editSrc.current === "slider") {
      editSrc.current = "amount";
      return;
    }
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
    editSrc.current = "amount";
    setRawInput(v);
  }

  function switchMode(m: "amount" | "percent") {
    setMode(m);
    setRawInput("");
  }

  function setMax() {
    if (mode === "percent") {
      setRawInput("100");
      return;
    }
    // Write a plain number string (no thousands separator). USD() returns
    // "1,001.45" — the comma is rejected by handleRawInput's regex, which
    // would freeze the field (every subsequent edit would be reverted).
    // Floor to 2dp so num never exceeds vaultBalance by float round-up
    // (which would trip the "Exceeds your available balance" guard).
    setRawInput((Math.floor(vaultBalance * 100) / 100).toFixed(2));
  }

  function close() {
    onClose();
    setRawInput("");
    setMode("amount");
    setSellPct({});
    setSubmittedAmount(0);
    setAssetPage(0);
    reset();
  }

  async function submit() {
    if (!valid || !vaultAddress || !address) return;
    setSubmittedAmount(num);
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
        <WithdrawProgress
          amount={submittedAmount}
          hash={hashes[hashes.length - 1]}
          onClose={close}
        />
      ) : (
        <>
          {/* ── Amount / Percent toggle + input ───────────── */}
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium text-dim">Amount</p>
            <div className="flex items-center rounded-full border border-edge bg-panel p-0.5">
              {(["amount", "percent"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`relative rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                    mode === m ? "text-white" : "text-dim hover:text-ink"
                  }`}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="withdraw-toggle-pill"
                      className="absolute inset-0 rounded-full bg-brand shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{m === "amount" ? "$" : "%"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-card px-4 py-3 transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-[#1591DC]/20">
            <span className="text-2xl font-semibold text-faint">
              {mode === "amount" ? "$" : "%"}
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={rawInput}
              onChange={(e) => handleRawInput(e.target.value)}
              placeholder="0.00"
              className="w-full min-w-0 bg-transparent text-2xl font-semibold tracking-[-0.02em] text-ink outline-none placeholder:text-faint"
            />
            <button
              onClick={setMax}
              className="shrink-0 rounded-md bg-panel px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
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
                  className="rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-dim transition-colors hover:border-brand hover:text-brand"
                >
                  {mode === "amount" ? `$${q.toLocaleString("en-US")}` : `${q}%`}
                </button>
              ))}
            </div>
            {mode === "percent" && parsedInput > 0 && (
              <span className="text-xs tabular-nums text-faint">≈ ${USD(num)}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-faint">Available: ${USD(vaultBalance)}</p>

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
                <div className="rounded-xl border border-edge p-3">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">
                      Assets to sell
                    </p>
                    {nonUsdcHoldings.length > ASSETS_PER_PAGE && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAssetPage((p) => Math.max(0, p - 1))}
                          disabled={assetPage === 0}
                          aria-label="Previous assets"
                          className="flex h-5 w-5 items-center justify-center rounded text-dim transition-colors hover:bg-panel hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2.25rem] text-center text-[10px] tabular-nums text-faint">
                          {assetPage + 1}/{totalAssetPages}
                        </span>
                        <button
                          onClick={() => setAssetPage((p) => Math.min(totalAssetPages - 1, p + 1))}
                          disabled={assetPage >= totalAssetPages - 1}
                          aria-label="Next assets"
                          className="flex h-5 w-5 items-center justify-center rounded text-dim transition-colors hover:bg-panel hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

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
                          <span className="text-xs font-medium text-ink">USDC</span>
                          <span className="text-xs text-dim">~${USD(usdcAvail)}</span>
                        </div>
                        <p className="text-[10px] text-faint">Available directly · no swap needed</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Non-USDC holdings with staggered sliders (paginated) */}
                  <div className="space-y-3">
                    {pagedHoldings.map((h, i) => {
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
                                <span className="text-xs font-medium text-ink">{h.symbol}</span>
                                <span className="text-xs tabular-nums text-dim">~${USD(proceeds)}</span>
                              </div>
                              <div className="mt-1.5">
                                <TokenSlider
                                  value={pct}
                                  onChange={(v) => {
                                    editSrc.current = "slider";
                                    const next = { ...sellPct, [h.symbol]: v };
                                    setSellPct(next);
                                    // reflect the new slider config in the amount above
                                    const tokenTotal = nonUsdcHoldings.reduce(
                                      (s, x) =>
                                        s +
                                        (x.valueUSD ?? 0) * (next[x.symbol] ?? 0) / 100,
                                      0,
                                    );
                                    const total =
                                      (usdcHolding?.valueUSD ?? 0) + tokenTotal;
                                    setRawInput(
                                      mode === "amount"
                                        ? USD(total)
                                        : vaultBalance > 0
                                          ? String(
                                              Math.min(
                                                100,
                                                Math.round((total / vaultBalance) * 100),
                                              ),
                                            )
                                          : "0",
                                    );
                                  }}
                                  color={accentColor}
                                />
                              </div>
                              <div className="mt-0.5 flex justify-between text-[10px] text-faint">
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
                    transition={{ delay: 0.08 + pagedHoldings.length * 0.055 + 0.05, duration: 0.2 }}
                    className={`mt-3 flex items-center justify-between rounded-lg px-2.5 py-2 ${
                      proceedsMet ? "bg-pos-soft" : "bg-neg-soft"
                    }`}
                  >
                    <span className={`text-xs ${proceedsMet ? "text-pos" : "text-neg"}`}>
                      Estimated proceeds
                    </span>
                    <span className={`text-xs font-semibold tabular-nums ${proceedsMet ? "text-pos" : "text-neg"}`}>
                      ~${USD(estimatedProceeds)}
                      {!proceedsMet && " · below target"}
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wallet destination */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-panel px-3 py-2 text-xs">
            <span className="text-dim">To your wallet</span>
            <span className="font-mono text-ink">
              {address ? truncateAddr(address) : "—"}
            </span>
          </div>

          {num > vaultBalance && vaultBalance > 0 && (
            <p className="mt-1 text-xs text-neg">Exceeds your available balance.</p>
          )}
          {error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-neg-soft px-3 py-2 text-xs text-neg">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Disclaimer */}
          {isMaxWithdraw || !showBreakdown ? (
            <p className="mt-3 text-xs leading-relaxed text-dim">
              All holdings are liquidated to USDC in the same transaction. Max slippage: 1%.
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Sliders reflect proportional liquidation. Exact execution is managed by your agent.
            </p>
          )}

          <SubmitButton verb="Withdraw" amount={num} busy={busy} disabled={!valid} onClick={submit} />
        </>
      )}
    </Modal>
  );
}
