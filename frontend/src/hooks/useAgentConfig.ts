"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { apiFetch } from "@/lib/api";

export interface AgentConfig {
  autoRebalanceEnabled?: boolean;
  cadenceSec?: number | null;
  driftThresholdBps?: number | null;
  maxSlippageBps?: number;
  perTokenCapsBps?: Record<string, number> | null;
  notes?: string | null;
  maxPerAssetPct?: number | null;
  dailyLimitPerDay?: number | null;
  stopLossEnabled?: boolean;
  stopLossPct?: number | null;
  /** Tokens the agent must not hold (soft "Avoid" list; the rebalancer drops + renormalizes). */
  excludedTokens?: string[];
}

export function useAgentConfig() {
  const { getAccessToken, authenticated } = usePrivy();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<AgentConfig>({
    queryKey: ["agent-config"],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiFetch<AgentConfig>("/api/users/me/agent-config", token);
    },
  });

  const { mutateAsync: save, isPending: isSaving } = useMutation({
    mutationFn: async (patch: Partial<AgentConfig>) => {
      const token = await getAccessToken();
      return apiFetch<AgentConfig>("/api/users/me/agent-config", token, {
        method: "POST",
        body: JSON.stringify(patch),
      });
    },
    onSuccess: (updated) => qc.setQueryData(["agent-config"], updated),
  });

  return { config: data, isLoading, save, isSaving };
}
