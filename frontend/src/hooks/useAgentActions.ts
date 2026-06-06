"use client";
import { useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";

export interface HermesResult {
  outcome: { action: string; reason?: string; hash?: string };
  reasoning: string;
  allocation: Record<string, number>;
  attempts: number;
  error?: string;
}

export function useAgentActions() {
  const { getAccessToken } = usePrivy();
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [isPausing, setIsPausing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<HermesResult | null>(null);

  const pause = useCallback(async () => {
    setIsPausing(true);
    try {
      const token = await getAccessToken();
      await fetch(`${base}/api/users/me/agent/pause`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally { setIsPausing(false); }
  }, [getAccessToken, base]);

  const resume = useCallback(async () => {
    setIsPausing(true);
    try {
      const token = await getAccessToken();
      await fetch(`${base}/api/users/me/agent/resume`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } finally { setIsPausing(false); }
  }, [getAccessToken, base]);

  const runHermes = useCallback(async (): Promise<HermesResult> => {
    setIsRunning(true);
    setLastResult(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${base}/api/users/me/agent/run-hermes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = (await res.json()) as HermesResult;
      setLastResult(data);
      return data;
    } finally { setIsRunning(false); }
  }, [getAccessToken, base]);

  return { pause, resume, runHermes, isPausing, isRunning, lastResult };
}
