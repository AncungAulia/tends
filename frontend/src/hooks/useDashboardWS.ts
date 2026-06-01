"use client";

import { useEffect, useRef, useState } from "react";

export type WSStatus = "connected" | "connecting" | "disconnected";

// Exponential backoff delays: 2s, 4s, 8s, 16s, 30s max
const BACKOFF = [2000, 4000, 8000, 16000, 30000];

/**
 * Connects to /ws/dashboard, filters events by vault address, and invokes
 * `onUpdate` on any matching event. Auto-reconnects with exponential backoff.
 * After the first failed attempt, stays "disconnected" instead of cycling
 * through "connecting" on every retry.
 */
export function useDashboardWS(
  vaultAddress: string | undefined,
  onUpdate: () => void,
) {
  const [status, setStatus] = useState<WSStatus>("connecting");
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return;
    const url = base.replace(/^http/, "ws") + "/ws/dashboard";

    let ws: WebSocket | undefined;
    let closed = false;
    let attempt = 0;

    const connect = () => {
      // Only show "connecting" on the very first attempt — subsequent retries
      // stay "disconnected" to avoid the flickering dot.
      if (attempt === 0) setStatus("connecting");

      try {
        ws = new WebSocket(url);
      } catch {
        setStatus("disconnected");
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0; // reset backoff on successful connection
        setStatus("connected");
      };
      ws.onclose = () => {
        setStatus("disconnected");
        scheduleReconnect();
      };
      ws.onerror = () => setStatus("disconnected");
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as { type?: string; vault?: string };
          if (ev.type === "connected") return;
          if (!vaultAddress) return;
          if (ev.vault?.toLowerCase() === vaultAddress.toLowerCase()) {
            onUpdateRef.current();
          }
        } catch {
          // ignore malformed frames
        }
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
      attempt++;
      setTimeout(connect, delay);
    };

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [vaultAddress]);

  return { status };
}
