"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { apiFetch } from "@/lib/api";

export interface ApiHolding {
  symbol: string;
  address: string;
  balance: string;
  valueUsd: string;
  allocationPct: number;
}

interface HoldingsResponse {
  holdings: ApiHolding[];
  totalValueUsd: string;
}

export function useHoldings() {
  const { getAccessToken, authenticated } = usePrivy();

  const { data, isLoading } = useQuery<HoldingsResponse>({
    queryKey: ["holdings"],
    enabled: authenticated,
    refetchInterval: 30_000,
    queryFn: async () => {
      const token = await getAccessToken();
      return apiFetch<HoldingsResponse>("/api/users/me/holdings", token);
    },
  });

  return {
    holdings: data?.holdings ?? [],
    totalValueUSD: Number(data?.totalValueUsd ?? "0"),
    isLoading,
  };
}
