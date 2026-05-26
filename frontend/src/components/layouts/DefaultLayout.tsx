"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { ChatBubble } from "./ChatBubble";
import { useUserVault } from "@/hooks/useUserVault";
import { useAuthVerify } from "@/hooks/useAuthVerify";
import { useDashboardWS } from "@/hooks/useDashboardWS";

/** App shell: sidebar + live WebSocket + chat. Used as the (app) group layout. */
export function DefaultLayout({ children }: { children: React.ReactNode }) {
  const { authenticated } = usePrivy();
  const { vaultAddress } = useUserVault();
  const queryClient = useQueryClient();

  useAuthVerify();

  const { status } = useDashboardWS(vaultAddress, () => {
    // Any matching vault event → refetch backend queries + SC reads
    queryClient.invalidateQueries();
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar wsStatus={status} />
      <main className="flex-1 px-4 py-6 pb-24 sm:px-8 md:pb-6">{children}</main>
      {authenticated && <ChatBubble />}
    </div>
  );
}
