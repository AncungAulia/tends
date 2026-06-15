"use client";

import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Droplets,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { useAccount } from "wagmi";
import { useTheme } from "next-themes";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import VaultCard from "@/components/preview/VaultCard";
import type { VaultRisk } from "@/components/preview/VaultCard";
import { useVaultStore } from "@/hooks/useVaultStore";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useMintTestUsdc } from "@/hooks/useMintTestUsdc";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import { apiFetch } from "@/lib/api";

/* ──────────────────────────────────────────────────────────
   Account page — Tends
   Hero = the vault, shown as a premium card. Settings below.
   ────────────────────────────────────────────────────────── */

const RISK_LABEL: Record<number, VaultRisk> = {
  0: "Low",
  1: "Medium",
  2: "High",
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[1.25px] border-edge bg-card p-5">
      {children}
    </div>
  );
}

// ─── Profile (name editable inline) ─────────────────────────

function Profile() {
  const { user, logout, getAccessToken } = usePrivy();
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

  // Load name from backend; fallback to Privy identity if not set
  useEffect(() => {
    async function load() {
      try {
        const token = await getAccessToken();
        const data = await apiFetch<{ name: string | null }>("/api/users/me/profile", token);
        if (data.name) { setName(data.name); return; }
      } catch { /* ignore */ }
      setName(
        user?.google?.name ??
        user?.email?.address?.split("@")[0] ??
        "You",
      );
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveName() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const token = await getAccessToken();
      await apiFetch("/api/users/me/profile", token, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setName(trimmed);
      toast.success("Name updated.");
    } catch {
      toast.error("Failed to save name.");
    }
  }

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "—";

  const connectedVia = user?.google?.email
    ? "Connected via Google"
    : user?.email?.address
      ? "Connected via Email"
      : "Connected via Wallet";

  function copy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-[#1591DC] to-[#2C5EAD]" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="w-40 rounded-md border border-brand px-2 py-0.5 text-sm font-semibold text-ink outline-none ring-2 ring-brand/15"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="group flex items-center gap-1.5"
            >
              <span className="text-sm font-semibold text-ink">{name || "—"}</span>
              <Pencil className="h-3 w-3 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <button
            onClick={copy}
            className="mt-0.5 flex items-center gap-1.5 text-xs text-dim transition-colors hover:text-ink"
          >
            {shortAddress}
            {copied ? (
              <Check className="h-3 w-3 text-pos" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <p className="mt-1.5 text-xs text-dim">{connectedVia}</p>
        </div>
        <button
          onClick={() => logout()}
          className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-medium text-neg transition-colors hover:bg-neg-soft"
        >
          <LogOut className="h-3.5 w-3.5" />
          Disconnect
        </button>
      </div>
    </Card>
  );
}

// ─── Preferences (theme) ────────────────────────────────────

type Theme = "system" | "light" | "dark";

function Preferences() {
  const { theme, setTheme } = useTheme();
  const options: { key: Theme; label: string; icon: typeof Sun }[] = [
    { key: "system", label: "System", icon: Monitor },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Theme</p>
          <p className="text-xs text-dim">How Tends looks on this device</p>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-panel p-0.5">
          {options.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`flex items-center gap-1.5 rounded-md border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === key
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-transparent text-dim hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Testnet faucet ─────────────────────────────────────────

function Faucet() {
  const { address } = useAccount();
  const { balance, refetch: refetchBalance } = useUSDCBalance(address);
  const { mint, isPending, isConfirming, isSuccess, reset } = useMintTestUsdc();
  const minting = isPending || isConfirming;

  useEffect(() => {
    if (isSuccess) {
      toast.success("Minted 1,000 test USDC.");
      refetchBalance();
      reset();
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Mock USDC faucet</p>
            <p className="text-xs text-dim">
              {balance !== undefined ? `Balance: ${balance} USDC · ` : ""}Test funds on Mantle Sepolia
            </p>
          </div>
        </div>
        <button
          onClick={() => mint(1000)}
          disabled={minting || !address}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending
            ? "Confirm in wallet..."
            : isConfirming
              ? "Minting..."
              : "Mint 1,000 USDC"}
        </button>
      </div>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function AccountPage() {
  const { address } = useAccount();
  const { user } = usePrivy();
  const vaultAddress = useVaultStore((s) => s.vaultAddress);

  const { totalAssetsUSDC, riskPreference } = usePortfolio(vaultAddress, address);

  const risk: VaultRisk = RISK_LABEL[riskPreference ?? 1] ?? "Medium";

  const defaultName =
    user?.google?.name ??
    user?.email?.address?.split("@")[0] ??
    "You";

  const shortVaultAddress = vaultAddress
    ? `${vaultAddress.slice(0, 6)} •••• •••• ${vaultAddress.slice(-4)}`
    : "— •••• •••• ————";

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">
        Account
      </h1>
      <p className="mt-1 text-sm text-dim">
        Your vault, profile, and preferences.
      </p>

      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* left — the vault, stretched to match the right column.
            click flips it to reveal vault details. */}
        <VaultCard
          name={defaultName}
          risk={risk}
          balance={totalAssetsUSDC > 0 ? totalAssetsUSDC : undefined}
          address={shortVaultAddress}
          fill
          back={
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[0.625rem] uppercase tracking-[0.12em] text-white/50">
                  Vault details
                </p>
                <RotateCcw className="h-3.5 w-3.5 text-white/40" />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/55">Estimated APY</span>
                  <span className="text-sm font-semibold">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/55">Total earned</span>
                  <span className="text-sm font-semibold text-green-300">—</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/55">Active since</span>
                  <span className="text-sm font-semibold">Apr 2026</span>
                </div>
              </div>
              <p className="font-mono text-[0.6875rem] tracking-wider text-white/55">
                {vaultAddress
                  ? `${vaultAddress.slice(0, 10)}...${vaultAddress.slice(-4)} · Mantle Sepolia`
                  : "No vault · Mantle Sepolia"}
              </p>
            </div>
          }
        />

        {/* right — your account */}
        <div className="space-y-4">
          <Profile />
          <Preferences />
          <Faucet />
        </div>
      </div>
    </div>
  );
}
