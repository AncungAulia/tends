"use client";

import { Wallet, ArrowRightLeft } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useBalance } from "wagmi";
import { formatUnits } from "viem";
import { useActiveWallet } from "@/hooks/useActiveWallet";

/** Privy walletClientType → human label. */
const WALLET_LABELS: Record<string, string> = {
  privy: "Email / Google wallet",
  metamask: "MetaMask",
  rabby_wallet: "Rabby",
  phantom: "Phantom",
  coinbase_wallet: "Coinbase Wallet",
  rainbow: "Rainbow",
  wallet_connect: "WalletConnect",
  okx_wallet: "OKX Wallet",
};

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Onboarding step 0. Before connecting → the connect prompt (wallet OR email/Google,
 * since Privy supports both). After connecting → CONFIRM the active wallet: which
 * wallet, its address, and its MNT (gas) balance, with a "Switch" option — so the user
 * deliberately picks the wallet their vault deploys with and can see up-front whether
 * they have gas (a 0-MNT embedded wallet is the #1 reason deploy fails).
 */
export function ConnectWallet({
  onConnect,
  onContinue,
}: {
  onConnect: () => void;
  onContinue: () => void;
}) {
  const { authenticated, connectWallet } = usePrivy();
  const { address, wallet } = useActiveWallet();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });

  if (!authenticated || !address) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">
          Let&apos;s set up your money
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#5B7490]">
          Connect a wallet — or just continue with email or Google — to begin. It stays
          yours; your agent can manage it but never move it out to itself.
        </p>
        <button
          onClick={onConnect}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Wallet className="h-4 w-4" /> Connect wallet
        </button>
        <p className="mt-4 text-xs text-[#94A3B8]">
          A minute of quick questions after this, then you&apos;re set.
        </p>
      </div>
    );
  }

  const label = WALLET_LABELS[wallet?.walletClientType ?? ""] ?? "Connected wallet";
  const mnt = balance ? Number(formatUnits(balance.value, balance.decimals)) : null;
  const noGas = mnt !== null && mnt === 0;

  return (
    <div className="text-center">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Confirm your wallet</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#5B7490]">
        Your vault deploys with this wallet. Switch if you want a different one.
      </p>

      <div className="mt-6 rounded-2xl border border-[#E8EAEC] bg-white p-4 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
            {label}
          </span>
          <button
            onClick={() => connectWallet()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1591DC] transition-opacity hover:opacity-80"
          >
            <ArrowRightLeft className="h-3 w-3" /> Switch
          </button>
        </div>
        <div className="mt-1 font-mono text-sm text-ink">{shortAddr(address)}</div>
        <div className="mt-3 flex items-baseline gap-1.5 border-t border-[#F1F5F9] pt-3">
          <span className="text-2xl font-semibold tabular-nums">
            {mnt === null ? "…" : mnt.toFixed(4)}
          </span>
          <span className="text-sm text-[#5B7490]">MNT</span>
          <span className="ml-auto self-center text-xs text-[#94A3B8]">for gas</span>
        </div>
      </div>

      {noGas && (
        <p className="mt-3 text-sm text-amber-600">
          ⚠️ 0 MNT — you need a little MNT to deploy &amp; transact. Get some from the{" "}
          <a
            href="https://faucet.sepolia.mantle.xyz"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            Mantle Sepolia faucet
          </a>{" "}
          then reload.
        </p>
      )}

      <button
        onClick={onContinue}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Continue
      </button>
    </div>
  );
}
