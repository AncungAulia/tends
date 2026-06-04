"use client";

import { useState } from "react";
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
import VaultCard from "@/components/preview/VaultCard";

/* ──────────────────────────────────────────────────────────
   Account page mock — Tends
   Hero = the vault, shown as a premium card. Settings below.
   ────────────────────────────────────────────────────────── */

const VAULT_BALANCE = 12430.5;
const RISK = "Medium" as const;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
      {children}
    </div>
  );
}

// ─── Profile (name editable inline) ─────────────────────────

function Profile() {
  const [name, setName] = useState("Ancung");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText("0x3f4a8c91b2e7d4f5a6c8b9e0d1f2a3b4c5d6c82b");
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
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              className="w-40 rounded-md border border-[#1591DC] px-2 py-0.5 text-sm font-semibold text-[#0C1A2B] outline-none ring-2 ring-[#1591DC]/15"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="group flex items-center gap-1.5"
            >
              <span className="text-sm font-semibold text-[#0C1A2B]">{name}</span>
              <Pencil className="h-3 w-3 text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          <button
            onClick={copy}
            className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5B7490] transition-colors hover:text-[#0C1A2B]"
          >
            0x3f4a...c82b
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <p className="mt-1.5 text-xs text-[#5B7490]">Connected via Google</p>
        </div>
        <button className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
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
  const [theme, setTheme] = useState<Theme>("light");
  const options: { key: Theme; label: string; icon: typeof Sun }[] = [
    { key: "system", label: "System", icon: Monitor },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#0C1A2B]">Theme</p>
          <p className="text-xs text-[#5B7490]">How Tends looks on this device</p>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-[#F7F9FC] p-0.5">
          {options.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`flex items-center gap-1.5 rounded-md border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === key
                  ? "border-[#1591DC] bg-[#EAF4FC] text-[#1591DC]"
                  : "border-transparent text-[#5B7490] hover:text-[#0C1A2B]"
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
  const [minting, setMinting] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF4FC] text-[#1591DC]">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0C1A2B]">Mock USDC faucet</p>
            <p className="text-xs text-[#5B7490]">Test funds on Mantle Sepolia</p>
          </div>
        </div>
        <button
          onClick={() => {
            setMinting(true);
            setTimeout(() => setMinting(false), 1500);
          }}
          disabled={minting}
          className="shrink-0 rounded-full bg-[#1591DC] px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {minting ? "Minting..." : "Mint 1,000 USDC"}
        </button>
      </div>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function AccountPreview() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">
        Account
      </h1>
      <p className="mt-1 text-sm text-[#5B7490]">
        Your vault, profile, and preferences.
      </p>

      <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* left — the vault, stretched to match the right column.
            click flips it to reveal vault details. */}
        <VaultCard
          name="Ancung"
          risk={RISK}
          balance={VAULT_BALANCE}
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
                  <span className="text-sm font-semibold">8.4%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/55">Total earned</span>
                  <span className="text-sm font-semibold text-green-300">
                    +$1,044
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/55">Active since</span>
                  <span className="text-sm font-semibold">Apr 2026</span>
                </div>
              </div>
              <p className="font-mono text-[0.6875rem] tracking-wider text-white/55">
                0x3f4a8c91...c82b · Mantle Sepolia
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
