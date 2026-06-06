"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { apiFetch } from "@/lib/api";

export interface AgentLogRow {
  id: string;
  vaultAddress: string;
  workflow: string;
  step: string;
  status: "done" | "skip" | "error";
  message: string;
  data?: Record<string, unknown>;
  ts: string;
}

/** Fetch persisted per-step agent log from the backend. */
export function useAgentLog(limit = 20) {
  const { getAccessToken, authenticated } = usePrivy();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["agent-log", limit],
    enabled: authenticated,
    refetchInterval: 30_000,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await apiFetch<{ activities: AgentLogRow[] }>(
        `/api/users/me/agent-log?limit=${limit}`,
        token,
      );
      return res.activities ?? [];
    },
  });

  return { logs: data ?? [], isLoading, refetch };
}
