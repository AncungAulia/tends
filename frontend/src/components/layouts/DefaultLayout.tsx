"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { useUserVault } from "@/hooks/useUserVault";
import { useAuthVerify } from "@/hooks/useAuthVerify";
import { useDashboardWS } from "@/hooks/useDashboardWS";
import { useAutoSwitchChain } from "@/hooks/useAutoSwitchChain";

/** App shell: sidebar + live WebSocket. Used as the (app) group layout. */
export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const { vaultAddress } = useUserVault();
  const queryClient = useQueryClient();

  useAuthVerify();
  useAutoSwitchChain();

  useDashboardWS(vaultAddress, () => {
    queryClient.invalidateQueries();
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-[#F9FBFC] px-4 py-6 pb-24 sm:px-8 md:pb-6 dark:bg-[#0A1628]">{children}</main>
    </div>
  );
}
