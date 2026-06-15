"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AllocationSlice {
  symbol: string;
  pct: number;
}

export interface StrategyView {
  id: string;
  name: string;
  tag: string;
  apyLabel: string;
  allocation: string;
  /** Structured breakdown — prefer this over regex-parsing `allocation`. */
  allocationBreakdown: AllocationSlice[];
  risk: string;
  blendedApyPct: number | null;
  // Setup card metadata (BE-A) — BE is the single source of truth.
  volatilityPct: number | null;
  description: string;
  holdHint: string;
  worstDropHint: string;
  bestFor: string;
}

export function useStrategies() {
  const { data, isLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: () => apiFetch<{ strategies: StrategyView[] }>("/api/strategies", null),
    staleTime: 5 * 60 * 1000,
  });

  return { strategies: data?.strategies ?? [], isLoading };
}
