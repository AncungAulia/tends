import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

/**
 * Conversation state lifted to a Zustand store with sessionStorage persistence.
 * This is what survives the "bubble disappears mid-conversation" bug. Local
 * useState in the hook lost the in-flight user message any time React
 * re-mounted the chat component (background query invalidations, gate
 * re-renders, hot reload, etc.). With the store outside the component tree,
 * an unmount/remount or a refresh restores messages from sessionStorage and
 * the user sees the same conversation they left, no need to click history.
 *
 * Transient runtime state (streaming, status) intentionally stays local to
 * useChat. We don't want streaming=true to survive a refresh and lock the
 * composer until the user reloads again.
 */
interface ChatPersistedState {
  messages: ChatMessage[];
  threadId: string;
  /** First send of this thread persists a title to the backend. */
  isNew: boolean;
  setMessages: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  setThreadId: (id: string) => void;
  setIsNew: (v: boolean) => void;
  newThread: () => void;
}

const initialThreadId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const useChatPersisted = create<ChatPersistedState>()(
  persist(
    (set) => ({
      messages: [],
      threadId: initialThreadId(),
      isNew: true,
      setMessages: (updater) =>
        set((s) => ({
          messages:
            typeof updater === "function" ? updater(s.messages) : updater,
        })),
      setThreadId: (id) => set({ threadId: id }),
      setIsNew: (v) => set({ isNew: v }),
      newThread: () =>
        set({ messages: [], threadId: initialThreadId(), isNew: true }),
    }),
    {
      name: "tends-chat-conversation",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? undefinedStorage : window.sessionStorage,
      ),
      partialize: (s) => ({
        messages: s.messages,
        threadId: s.threadId,
        isNew: s.isNew,
      }),
    },
  ),
);

// Safe placeholder storage for SSR (window is undefined on server).
const undefinedStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Chat with Tends Agent via SSE (POST /api/chat-v2). Streams reply token by token.
 *  Manages thread IDs for multi-session chat history. */
export function useChat() {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  // Persisted: messages + thread id + first-send flag (survives unmount/refresh).
  const messages = useChatPersisted((s) => s.messages);
  const threadId = useChatPersisted((s) => s.threadId);
  const setMessages = useChatPersisted((s) => s.setMessages);
  const setThreadId = useChatPersisted((s) => s.setThreadId);
  const setIsNew = useChatPersisted((s) => s.setIsNew);
  const newThread = useChatPersisted((s) => s.newThread);
  // Transient: streaming + tool status. Intentionally not persisted.
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return;

      setMessages((prev) => [...prev, { role: "user", text: message }]);
      setStreaming(true);

      try {
        const token = await getAccessToken();
        // Read+clear the first-send flag from the store rather than a ref so
        // the value survives an unmount-during-stream the same way messages do.
        const isNew = useChatPersisted.getState().isNew;
        const title = isNew ? message.slice(0, 60) : undefined;
        if (isNew) setIsNew(false);

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
          setMessages((prev) => {
            // Only treat the last message as the in-flight hermes when it IS
            // the hermes we appended. Without this guard a stray re-render
            // that lands a user message at the tail could be silently
            // overwritten by the next text chunk. Defensive but cheap.
            if (
              hermesAdded &&
              prev.length > 0 &&
              prev[prev.length - 1].role === "hermes"
            ) {
              return [...prev.slice(0, -1), msg];
            }
            return [...prev, msg];
          });
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
              // The backend can emit `done` without ever sending a text/card
              // event (LLM cold-start, quota error swallowed upstream, etc.).
              // Surface that to the user instead of leaving their question
              // sitting alone with no reply. They'd otherwise think the chat
              // is broken when it just needs a retry.
              if (!hermesAdded) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "hermes" as const,
                    text:
                      "Tends Agent didn't return anything just now. Try sending your message again.",
                  },
                ]);
              }
              setStatus(null);
              setStreaming(false);
              // the agent may have changed guardrails / pause / holdings,
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
    [
      getAccessToken,
      streaming,
      threadId,
      queryClient,
      setMessages,
      setIsNew,
    ],
  );

  /** Start a fresh conversation. New thread ID, clear messages. */
  const newChat = useCallback(() => {
    newThread();
    setStatus(null);
    setStreaming(false);
  }, [newThread]);

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
      setIsNew(false);
      setMessages(data.messages ?? []);
      setStatus(null);
      setStreaming(false);
    },
    [getAccessToken, setThreadId, setIsNew, setMessages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setStreaming(false);
    setStatus(null);
  }, [setMessages]);

  return { messages, sendMessage, streaming, status, reset, threadId, newChat, loadThread };
}
