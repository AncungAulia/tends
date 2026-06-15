"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AgentActivityLogAbi } from "@/lib/abis/AgentActivityLogAbi";
import { ADDRESSES } from "@/lib/addresses";
import { useVaultStore } from "@/hooks/useVaultStore";

export interface ActivityEntry {
  id: string;
  action: string;
  metadata: unknown;
  timestamp: Date;
  txHash?: string;
}

interface RawActivity {
  id: string | number;
  action: string;
  metadata?: unknown;
  timestamp: string;
  txHash?: string;
}

export interface PnlPoint {
  t: number;        // unix seconds (UTCTimestamp)
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

interface PnlData {
  initialDepositUsd: number;
  points: PnlPoint[];
}

/** Portfolio value / PnL time-series for the chart. range = "7d"|"30d"|"90d"|"1y". */
export function usePnl(range: string) {
  const { getAccessToken, authenticated } = usePrivy();
  const { data, isLoading } = useQuery<PnlData>({
    queryKey: ["pnl", range],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiFetch<PnlData>(`/api/users/me/pnl?range=${range}`, token);
    },
  });
  return {
    points: data?.points ?? [],
    initialDepositUsd: data?.initialDepositUsd ?? 0,
    isLoading,
  };
}

/**
 * Agent activity for the user. Primary: backend (GET /api/users/me/activity).
 * Fallback: on-chain AgentActivityLog by vault — so the rebalance log still
 * shows when the backend is erroring or its DB is out of sync.
 */
export function useActivity(limit = 50) {
  const { getAccessToken, authenticated } = usePrivy();
  const vaultAddress = useVaultStore((s) => s.vaultAddress);

  const {
    data: backendData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["activity", limit],
    enabled: authenticated,
    retry: 1,
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await apiFetch<{ activities: RawActivity[] }>(
        `/api/users/me/activity?limit=${limit}`,
        token,
      );
      return (res.activities ?? []).map(
        (a): ActivityEntry => ({
          id: String(a.id),
          action: a.action,
          metadata: a.metadata,
          timestamp: new Date(a.timestamp),
          txHash: a.txHash,
        }),
      );
    },
  });

  const backendActivities = backendData ?? [];
  const needFallback = (isError || backendActivities.length === 0) && !!vaultAddress;

  const { data: onchain } = useReadContract({
    address: ADDRESSES.ACTIVITY_LOG,
    abi: AgentActivityLogAbi,
    functionName: "getActivitiesByVault",
    args: [vaultAddress!, 50n],
    query: { enabled: needFallback },
  });

  const onchainActivities: ActivityEntry[] = (onchain ?? [])
    .map((a) => ({
      id: String(a.id),
      action: a.action,
      metadata: undefined,
      timestamp: new Date(Number(a.timestamp) * 1000),
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const all = backendActivities.length ? backendActivities : onchainActivities;

  return {
    activities: all,
    isLoading,
    refetch,
  };
}
