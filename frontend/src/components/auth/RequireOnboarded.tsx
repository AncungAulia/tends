"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useUserVault } from "@/hooks/useUserVault";

/**
 * Gates the authenticated app shell. A user may only reach the dashboard once they
 * are connected AND have a deployed vault (i.e. finished onboarding). Anyone not
 * onboarded is redirected to /onboarding — otherwise they land on the dashboard with
 * no vault, where Deposit/Withdraw can't work (the button is disabled / has no target).
 *
 * /onboarding itself is NOT in this (app) route group, so it stays reachable; once the
 * vault is deployed there, the onboarding page sends the user on to /overview.
 */
export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { hasVault, isVaultLoading } = useUserVault();

  // Still resolving auth or the vault lookup — don't decide yet.
  const resolving = !ready || (authenticated && isVaultLoading);
  // Connected but no vault, or not connected at all → must onboard first.
  const blocked = ready && (!authenticated || (!isVaultLoading && !hasVault));

  useEffect(() => {
    if (blocked) router.replace("/onboarding");
  }, [blocked, router]);

  if (resolving) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-400">
        Loading your vault…
      </div>
    );
  }
  if (blocked) return null; // redirecting to /onboarding

  return <>{children}</>;
}
