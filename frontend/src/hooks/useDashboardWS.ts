"use client";

import { useEffect, useRef, useState } from "react";

export type WSStatus = "connected" | "connecting" | "disconnected";

/**
 * Connects to /ws/dashboard, filters events by vault address, and invokes
 * `onUpdate` on any matching event. Auto-reconnects on close.
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

    const connect = () => {
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus("disconnected");
        return;
      }
      setStatus("connecting");

      ws.onopen = () => setStatus("connected");
      ws.onclose = () => {
        setStatus("disconnected");
        if (!closed) setTimeout(connect, 2000); // auto-reconnect
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

    connect();
    return () => {
      closed = true;
      ws?.close();
    };
  }, [vaultAddress]);

  return { status };
}
