"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import VaultCard from "@/components/elements/VaultCard";
import { useUserVault } from "@/hooks/useUserVault";
import { useRiskLevel } from "@/hooks/useRiskLevel";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { apiFetch } from "@/lib/api";
import type { Risk } from "./types";

interface Props {
  name: string;
  goal?: string; // 'safe' | 'steady' | 'max'  (backend `goal`)
  dips?: string; // 'out' | 'wait' | 'add'      (backend `riskTolerance`)
  risk: Risk;
  stopLoss: number;
}

const RISK_TO_STRATEGY: Record<Risk, "LOW" | "MEDIUM" | "HIGH"> = {
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
};

type Phase = "idle" | "deploying" | "saving" | "strategy" | "error";

/**
 * Final onboarding step — this is where onboarding ACTUALLY happens:
 *   1. deploy the user's vault on-chain (deployVault)
 *   2. persist the onboarding answers (PATCH /api/users/me → sets onboardedAt)
 *   3. set the vault's risk strategy from the chosen risk (best-effort, 1 tx)
 *   4. enter the dashboard
 * Order matters: persist runs before the (best-effort) strategy tx, so onboarding is
 * marked complete + the vault exists even if the strategy tx is skipped/fails — the
 * RequireOnboarded guard then lets the user in instead of looping back here.
 */
export function OnboardingResult({ name, goal, dips, risk }: Props) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const { address: activeAddress } = useActiveWallet();
  const { deployVault, vaultAddress, hasVault, error: deployError } = useUserVault();
  const { setStrategy } = useRiskLevel(vaultAddress);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState("");
  const finalizing = useRef(false);

  const start = async () => {
    setErrMsg("");
    if (!activeAddress) {
      setErrMsg("Connect a wallet first.");
      return;
    }
    finalizing.current = false;
    if (hasVault && vaultAddress) {
      void finalize(); // already deployed (retry / pre-existing) → just finish
      return;
    }
    setPhase("deploying");
    try {
      await deployVault();
    } catch (e) {
      // a vault that already exists is fine — finalize once it resolves
      if (/VaultAlreadyExists/i.test(asMessage(e))) return;
      setPhase("error");
      setErrMsg(humanizeTxError(e));
    }
  };

  // Deploy confirmed (vault address resolved via the on-chain fallback) → finalize once.
  // Only after the user actually started a deploy (phase === "deploying") — never auto-run.
  useEffect(() => {
    if (phase === "deploying" && vaultAddress && !finalizing.current) {
      void finalize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, vaultAddress]);

  // Surface a deploy revert.
  useEffect(() => {
    if (phase === "deploying" && deployError && !/VaultAlreadyExists/i.test(asMessage(deployError))) {
      setPhase("error");
      setErrMsg(humanizeTxError(deployError));
    }
  }, [phase, deployError]);

  async function finalize() {
    if (finalizing.current) return;
    finalizing.current = true;

    // 1. persist onboarding answers — sets onboardedAt (the completion marker). Reliable, off-chain.
    setPhase("saving");
    try {
      const token = await getAccessToken();
      await apiFetch("/api/users/me", token, {
        method: "PATCH",
        body: JSON.stringify({ displayName: name || undefined, goal, riskTolerance: dips }),
      });
    } catch {
      /* non-fatal — the vault exists; profile is editable in Account */
    }
    localStorage.removeItem("tends_pending_name");

    // 2. set the on-chain risk strategy (best-effort — vault runs at its default otherwise,
    //    and the user can change it in Settings; never block entering the app on this tx).
    setPhase("strategy");
    try {
      await setStrategy(RISK_TO_STRATEGY[risk]);
    } catch {
      /* editable later in Settings */
    }

    router.replace("/overview");
  }

  const busy = phase === "deploying" || phase === "saving" || phase === "strategy";
  const label =
    phase === "deploying"
      ? "Deploying your vault…"
      : phase === "saving"
        ? "Saving your profile…"
        : phase === "strategy"
          ? "Setting your strategy…"
          : phase === "error"
            ? "Try again"
            : "Deploy & enter Tends";

  return (
    <div>
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">
          {name ? `You're all set, ${name}!` : "You're all set!"}
        </h2>
        <p className="mt-1.5 text-sm text-[#5B7490]">
          We&apos;ll deploy your vault and hand it to your agent.
        </p>
      </div>

      <VaultCard name={name} risk={risk} />

      {/* The wallet was already connected at step 0 (single connect point) and persists
          here via useActiveWallet — no second connect. Just show which one will deploy. */}
      {activeAddress && (
        <p className="mt-3 text-center text-xs text-[#5B7490]">
          Deploying with {shortAddr(activeAddress)}
        </p>
      )}

      {errMsg && <p className="mt-2 text-center text-sm text-red-500">{errMsg}</p>}

      <button
        type="button"
        onClick={start}
        disabled={busy || !activeAddress}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {label}
      </button>
    </div>
  );
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function asMessage(e: unknown): string {
  return (e as Error)?.message ?? String(e);
}

function humanizeTxError(e: unknown): string {
  const msg = asMessage(e);
  if (/insufficient funds/i.test(msg)) return "Not enough MNT for gas — top up your wallet and try again.";
  if (/rejected|denied|user denied/i.test(msg)) return "Transaction rejected. Tap to try again.";
  return "Couldn't deploy your vault. Tap to try again.";
}
