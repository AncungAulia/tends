"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { MobileTopBar } from "./MobileTopBar";
import { BottomNav } from "./BottomNav";
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
    <div className="flex min-h-dvh bg-app text-ink">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <MobileTopBar />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
