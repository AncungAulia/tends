import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";

export type ChatCard =
  | {
      type: "holdings";
      holdings: { symbol: string; valueUsd: string; allocationPct: number }[];
      totalValueUsd: string;
    }
  | {
      type: "action";
      kind: "move" | "deposit" | "withdraw";
      title: string;
      subtitle: string;
      proposal: { targetBps: Record<string, number>; reasoning: string };
    };

export interface ChatMessage {
  role: "user" | "hermes";
  text: string;
  /** Optional rich card streamed by the agent (holdings view or action proposal). */
  card?: ChatCard;
}

const TOOL_LABELS: Record<string, string> = {
  getUserProfile: "Reading your profile",
  getHoldings: "Looking at your holdings",
  getAgentSettings: "Checking your guardrails",
  readUserPosition: "Checking your vault",
  getRecentActivity: "Looking back at recent moves",
  listStrategies: "Comparing strategies",
  computeProjection: "Crunching the numbers",
  getApyHistory: "Checking yield history",
  setAgentGuardrails: "Updating your guardrails",
  triggerRebalance: "Starting a rebalance",
  proposeSwap: "Preparing a swap",
  executeDirectSwap: "Making the swap",
};

/** Chat with Tends Agent via SSE (POST /api/chat-v2). Streams reply token by token.
 *  Manages thread IDs for multi-session chat history. */
export function useChat() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>(() => crypto.randomUUID());
  const isNewRef = useRef(true);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return;

      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setStreaming(true);

      try {
        const token = await getAccessToken();
        const isNew = isNewRef.current;
        const title = isNew ? message.slice(0, 60) : undefined;
        isNewRef.current = false;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/chat-v2`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message, thread: threadId, isNew, title }),
          },
        );

        if (!res.body) throw new Error("No response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        let buffer = "";
        let hermesAdded = false;
        let card: ChatCard | undefined;

        // Create or update the single in-flight hermes message with the latest
        // streamed text + card. Works whether a card arrives before or after text.
        const upsertHermes = () => {
          const msg: ChatMessage = { role: "hermes", text: reply, card };
          setMessages((prev) =>
            hermesAdded ? [...prev.slice(0, -1), msg] : [...prev, msg],
          );
          hermesAdded = true;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const evt of events) {
            if (!evt.trim()) continue;
            let type = "text";
            const dataLines: string[] = [];
            for (const line of evt.split("\n")) {
              if (line.startsWith("event:")) {
                type = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(line[5] === " " ? 6 : 5));
              }
            }

            if (type === "done") {
              setStatus(null);
              setStreaming(false);
              // the agent may have changed guardrails / pause / holdings —
              // refetch so the rest of the UI reflects it
              queryClient.invalidateQueries();
              return;
            }
            if (type === "error") {
              const errMsg = dataLines.join("") || "Tends Agent encountered an error.";
              setMessages((prev) => [
                ...prev,
                { role: "hermes" as const, text: `⚠️ ${errMsg}` },
              ]);
              setStatus(null);
              setStreaming(false);
              return;
            }
            if (type === "status") {
              const toolName = dataLines.join("").trim();
              setStatus(TOOL_LABELS[toolName] ?? toolName);
              continue;
            }
            if (type === "card") {
              try {
                card = JSON.parse(dataLines.join("\n")) as ChatCard;
                setStatus(null);
                upsertHermes();
              } catch {
                // ignore malformed card payloads
              }
              continue;
            }
            reply += dataLines.join("\n");
            setStatus(null);
            upsertHermes();
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "hermes" as const, text: "Tends Agent is unavailable. Try again." },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [getAccessToken, streaming, threadId, queryClient],
  );

  /** Start a fresh conversation — new thread ID, clear messages. */
  const newChat = useCallback(() => {
    setThreadId(crypto.randomUUID());
    isNewRef.current = true;
    setMessages([]);
    setStatus(null);
    setStreaming(false);
  }, []);

  /** Load historical messages from an existing thread. */
  const loadThread = useCallback(
    async (tid: string) => {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat-sessions/${tid}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      setThreadId(tid);
      isNewRef.current = false;
      setMessages(data.messages ?? []);
      setStatus(null);
      setStreaming(false);
    },
    [getAccessToken],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setStreaming(false);
    setStatus(null);
  }, []);

  return { messages, sendMessage, streaming, status, reset, threadId, newChat, loadThread };
}
