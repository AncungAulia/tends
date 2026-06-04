"use client";

import { useState } from "react";
import { Copy, Check, Monitor, Sun, Moon, LogOut, Droplets } from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Account page mock — Tends
   Light theme, Aspekta, blue tones. Mercury-inspired.
   ────────────────────────────────────────────────────────── */

// ─── Section wrapper ────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490]">
        {title}
      </p>
      {children}
    </section>
  );
}

// ─── Profile ────────────────────────────────────────────────

function Profile() {
  const [copied, setCopied] = useState(false);
  const address = "0x3f4a8c91b2e7d4f5a6c8b9e0d1f2a3b4c5d6c82b";

  function copy() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-[#1591DC] to-purple-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0C1A2B]">ancung.eth</p>
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
    </div>
  );
}

// ─── Preferences ────────────────────────────────────────────

type Theme = "system" | "light" | "dark";

function Preferences() {
  const [theme, setTheme] = useState<Theme>("light");

  const options: { key: Theme; label: string; icon: typeof Sun }[] = [
    { key: "system", label: "System", icon: Monitor },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
      <div className="flex items-center justify-between">
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
                  : "border-[#E8EAEC] bg-white text-[#5B7490] hover:text-[#0C1A2B]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Testnet faucet ─────────────────────────────────────────

function Faucet() {
  const [minting, setMinting] = useState(false);

  return (
    <div className="rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF4FC] text-[#1591DC]">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0C1A2B]">Mock USDC faucet</p>

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
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function AccountPreview() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0C1A2B]">Account</h1>
          <p className="mt-1 text-sm text-[#5B7490]">Your wallet, preferences, and funds.</p>

          <div className="mt-6">
            <Section title="Profile">
              <Profile />
            </Section>

            <Section title="Preferences">
              <Preferences />
            </Section>

            <Section title="Faucet">
              <Faucet />
            </Section>
          </div>
        </div>
  );
}
