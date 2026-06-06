"use client";
import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

export type LogStatus = "running" | "done" | "skip" | "error";

export interface AgentLogEntry {
  id: string;
  ts: string;
  vaultAddress: string;
  workflow: string;
  step: string;
  status: LogStatus;
  message: string;
  data?: Record<string, unknown>;
}

export function useAgentLogStream(vaultAddress: string | undefined) {
  const { getAccessToken, authenticated } = usePrivy();
  const [liveEntries, setLiveEntries] = useState<AgentLogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!authenticated || !vaultAddress) return;
    const controller = new AbortController();

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/users/me/agent/log/stream`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
        );
        if (!res.body || !res.ok) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        setConnected(true);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.trim()) continue;
            let type = "message";
            let data = "";
            for (const line of part.split("\n")) {
              if (line.startsWith("event:")) type = line.slice(6).trim();
              else if (line.startsWith("data:")) data = line.slice(line[5] === " " ? 6 : 5);
            }
            if (type === "connected" || type === "ping") continue;
            if (data) {
              try {
                const entry = JSON.parse(data) as AgentLogEntry;
                setLiveEntries((prev) => [entry, ...prev].slice(0, 50));
              } catch { /* ignore */ }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setConnected(false);
      } finally {
        setConnected(false);
      }
    })();

    return () => { controller.abort(); };
  }, [authenticated, vaultAddress]);

  return { liveEntries, connected };
}
