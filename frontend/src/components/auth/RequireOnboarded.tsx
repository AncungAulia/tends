"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useUserVault } from "@/hooks/useUserVault";

/**
 * Gates the authenticated app shell. A user may only reach the dashboard once they
 * are connected AND have a deployed vault (i.e. finished onboarding). Anyone not
 * onboarded is redirected to /onboarding. Otherwise they land on the dashboard with
 * no vault, where Deposit/Withdraw can't work (the button is disabled / has no target).
 *
 * /onboarding itself is NOT in this (app) route group, so it stays reachable; once the
 * vault is deployed there, the onboarding page sends the user on to /overview.
 */
export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { hasVault, isVaultLoading } = useUserVault();

  // Still resolving auth or the vault lookup, so don't decide yet.
  const resolving = !ready || (authenticated && isVaultLoading);
  // Connected but no vault, or not connected at all → must onboard first.
  const blocked = ready && (!authenticated || (!isVaultLoading && !hasVault));

  // STICKY: once we've resolved the gate at least once, NEVER unmount the
  // children again on transient re-resolutions. Background query refetches
  // (e.g. queryClient.invalidateQueries() fired by useChat after each stream)
  // were briefly flipping isVaultLoading back to true on some screens, which
  // re-rendered "Loading your vault…" and tore down everything underneath,
  // wiping local state like the in-flight chat message bubble until the user
  // refreshed and loaded the thread from the backend.
  const hasResolvedOnce = useRef(false);
  useEffect(() => {
    if (!resolving) hasResolvedOnce.current = true;
  }, [resolving]);

  useEffect(() => {
    if (blocked) router.replace("/onboarding");
  }, [blocked, router]);

  if (resolving && !hasResolvedOnce.current) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
        Loading your vault…
      </div>
    );
  }
  if (blocked) return null; // redirecting to /onboarding

  return <>{children}</>;
}
