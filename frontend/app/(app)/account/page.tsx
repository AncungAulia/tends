"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  Copy,
  Check,
  LogOut,
  Droplets,
  Pencil,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useTheme } from "next-themes";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import VaultCard from "@/components/preview/VaultCard";
import type { VaultRisk } from "@/components/preview/VaultCard";
import { CardDesignPicker } from "@/components/elements/CardDesignPicker";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { useVaultStore } from "@/hooks/useVaultStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useUserVault } from "@/hooks/useUserVault";
import { useMintTestUsdc } from "@/hooks/useMintTestUsdc";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { useCardDesign } from "@/hooks/useCardDesign";
import { CARD_DESIGNS } from "@/lib/cardDesigns";
import { USDC_DECIMALS } from "@/lib/addresses";
import { apiFetch } from "@/lib/api";
import { cn } from "@/utils/cn";

/* ──────────────────────────────────────────────────────────
   Account page — Tends
   Hero (vault card + identity) · vault stats · settings list.
   ────────────────────────────────────────────────────────── */

const RISK_LABEL: Record<number, VaultRisk> = {
  0: "Low",
  1: "Medium",
  2: "High",
};
const EXPLORER = "https://explorer.sepolia.mantle.xyz/address/";

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Small primitives ───────────────────────────────────────

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.key
              ? "border-brand bg-brand-soft text-brand"
              : "border-transparent text-dim hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-dim">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[0.625rem] uppercase tracking-widest text-faint">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function AccountPage() {
  const { address } = useAccount();
  const { user, logout, getAccessToken } = usePrivy();
  const { theme, setTheme } = useTheme();

  const vaultAddress = useVaultStore((s) => s.vaultAddress);
  const { totalAssetsUSDC, riskPreference, paused } = usePortfolio(
    vaultAddress,
    address,
  );
  const { initialDeposit } = useUserVault();
  const { design, setDesign } = useCardDesign();
  const { balance, refetch: refetchBalance } = useUSDCBalance(address);
  const {
    mint,
    isPending: minting,
    isConfirming,
    isSuccess: minted,
    reset: resetMint,
  } = useMintTestUsdc();

  const [designOpen, setDesignOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // profile: editable display name (persisted to backend)
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const data = await apiFetch<{ displayName: string | null }>(
          "/api/users/me/profile",
          token,
        );
        setName(
          data.displayName ??
            user?.google?.name ??
            user?.email?.address?.split("@")[0] ??
            "You",
        );
      } catch {
        setName(
          user?.google?.name ?? user?.email?.address?.split("@")[0] ?? "You",
        );
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveName() {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const token = await getAccessToken();
      await apiFetch("/api/users/me", token, {
        method: "PATCH",
        body: JSON.stringify({ displayName: trimmed }),
      });
      setName(trimmed);
      toast.success("Name updated.");
    } catch {
      toast.error("Couldn't save. Try again.");
    }
  }

  useEffect(() => {
    if (minted) {
      toast.success("Minted 1,000 test USDC.");
      refetchBalance();
      resetMint();
    }
  }, [minted]); // eslint-disable-line react-hooks/exhaustive-deps

  // derived
  const risk: VaultRisk = RISK_LABEL[riskPreference ?? 1] ?? "Medium";
  const deposited = initialDeposit
    ? Number(initialDeposit) / 10 ** USDC_DECIMALS
    : 0;
  const hasFunds = totalAssetsUSDC > 0;
  const pnl = totalAssetsUSDC - deposited;
  const pnlUp = pnl >= 0;

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "—";
  const cardAddress = vaultAddress
    ? `${vaultAddress.slice(0, 6)} •••• •••• ${vaultAddress.slice(-4)}`
    : "— •••• •••• ————";
  const connectedVia = user?.google?.email
    ? "Connected via Google"
    : user?.email?.address
      ? "Connected via Email"
      : "Connected via Wallet";
  const currentDesignLabel =
    CARD_DESIGNS.find((d) => d.id === design)?.label ?? "Ocean Contour";

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-2 md:px-8 md:py-8">
      <div className="hidden md:block">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
          Account
        </h1>
        <p className="mt-1 text-sm text-dim">
          Your vault, profile, and preferences.
        </p>
      </div>

      {/* ─── HERO: card + identity ─── */}
      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <VaultCard
          name={name}
          risk={risk}
          balance={hasFunds ? totalAssetsUSDC : undefined}
          address={cardAddress}
          design={design}
          back={
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-2.5"></div>
              <p className="font-mono text-[0.6875rem] tracking-wider text-white/55">
                {vaultAddress
                  ? `${vaultAddress.slice(0, 10)}...${vaultAddress.slice(-4)}`
                  : "No vault"}
              </p>
            </div>
          }
        />

        {/* identity panel — stretches to the card's height */}
        <div className="flex flex-col justify-between gap-5 rounded-2xl border-[1.25px] border-edge bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-[#1591DC] to-[#2C5EAD]" />
              <div className="min-w-0">
                {editingName ? (
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="w-44 rounded-md border border-brand px-2 py-0.5 text-base font-semibold text-ink outline-none ring-2 ring-brand/15"
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="group flex items-center gap-1.5"
                  >
                    <span className="text-base font-semibold text-ink">
                      {name || "—"}
                    </span>
                    <Pencil className="h-3 w-3 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
                <button
                  onClick={copyAddress}
                  className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-dim transition-colors hover:text-ink"
                >
                  {shortAddress}
                  {copied ? (
                    <Check className="h-3 w-3 text-pos" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                <p className="mt-1 text-xs text-faint">{connectedVia}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              aria-label="Disconnect wallet"
              className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-medium text-neg transition-colors hover:bg-neg-soft dark:border-red-500/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>

          {/* vault facts */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-edge pt-5">
            <Fact label="Network">Mantle Sepolia</Fact>
            <Fact label="Status">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    paused ? "bg-warn" : "bg-pos",
                  )}
                />
                {paused ? "Paused" : "Active"}
              </span>
            </Fact>
            <Fact label="Risk tier">{risk}</Fact>
            <Fact label="Vault">
              {vaultAddress ? (
                <a
                  href={`${EXPLORER}${vaultAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-brand transition-opacity hover:opacity-80"
                >
                  {vaultAddress.slice(0, 6)}...{vaultAddress.slice(-4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-dim">No vault yet</span>
              )}
            </Fact>
          </div>
        </div>
      </div>

      {/* ─── vault stats band ─── */}
      <div className="mt-5 grid grid-cols-3 divide-x divide-edge rounded-2xl border-[1.25px] border-edge bg-card *:p-5">
        <div>
          <p className="text-[0.625rem] uppercase tracking-widest text-faint">
            Total value
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
            ${fmtUSD(totalAssetsUSDC)}
          </p>
        </div>
        <div>
          <p className="text-[0.625rem] uppercase tracking-widest text-faint">
            Deposited
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
            {deposited > 0 ? `$${fmtUSD(deposited)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[0.625rem] uppercase tracking-widest text-faint">
            Net P&amp;L
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-lg font-semibold tracking-[-0.02em] sm:text-xl",
              deposited > 0 ? (pnlUp ? "text-pos" : "text-neg") : "text-ink",
            )}
          >
            {deposited > 0
              ? `${pnlUp ? "+" : "-"}$${fmtUSD(Math.abs(pnl))}`
              : "—"}
          </p>
        </div>
      </div>

      {/* ─── settings list ─── */}
      <div className="mt-5 divide-y divide-edge rounded-2xl border-[1.25px] border-edge bg-card px-5 sm:px-6">
        <Row label="Theme" hint="How Tends looks on this device">
          <Segmented
            value={(theme as Theme) ?? "system"}
            options={[
              { key: "system", label: "System" },
              { key: "light", label: "Light" },
              { key: "dark", label: "Dark" },
            ]}
            onChange={(t) => setTheme(t)}
          />
        </Row>
        <Row label="Card design" hint={currentDesignLabel}>
          <button
            onClick={() => setDesignOpen(true)}
            className="rounded-full border-[1.25px] border-edge px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:border-dim"
          >
            Change
          </button>
        </Row>
        <Row
          label="USDC Faucet"
          hint={
            balance !== undefined
              ? `${balance} USDC · USDC faucet for testnet`
              : "USDC faucet for testnet"
          }
        >
          <button
            onClick={() => mint(1000)}
            disabled={minting || isConfirming || !address}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {minting
              ? "Confirm..."
              : isConfirming
                ? "Minting..."
                : "Mint 1,000"}
          </button>
        </Row>
      </div>

      <div className="h-10" />

      {/* card design overlay */}
      <ResponsiveDialog
        open={designOpen}
        onClose={() => setDesignOpen(false)}
        title="Card design"
      >
        <p className="mb-4 text-sm text-dim">
          Pick a look for your vault card. Style only, it doesn&apos;t change
          how the vault works.
        </p>
        <CardDesignPicker value={design} onChange={setDesign} />
      </ResponsiveDialog>
    </div>
  );
}

type Theme = "system" | "light" | "dark";
