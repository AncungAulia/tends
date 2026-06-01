import { usePrivy } from "@privy-io/react-auth";
import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "hermes";
  text: string;
}

/** Chat with Tends Agent via SSE (POST /api/chat). Streams reply token by token. */
export function useChat() {
  const { getAccessToken } = usePrivy();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || streaming) return;

      // Add the user message AND an empty Tends Agent message up-front so the typing
      // loader appears during the whole wait (token + network + first token).
      setMessages((prev) => [
        ...prev,
        { role: "user", text: message },
        { role: "hermes", text: "" },
      ]);
      setStreaming(true);

      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message }),
          },
        );

        if (!res.body) throw new Error("No response stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE events are separated by a blank line; keep the trailing partial.
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
                // strip "data:" + one optional leading space — preserve the rest
                dataLines.push(line.slice(line[5] === " " ? 6 : 5));
              }
            }

            if (type === "done" || type === "error") {
              setStreaming(false);
              return;
            }
            // Multiple data lines in one event represent newline-separated text.
            reply += dataLines.join("\n");
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "hermes", text: reply },
            ]);
          }
        }
      } catch {
        // Replace the pending (empty) Tends Agent message with the error.
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          const errored = { role: "hermes" as const, text: "Tends Agent is unavailable. Try again." };
          if (last?.role === "hermes") copy[copy.length - 1] = errored;
          else copy.push(errored);
          return copy;
        });
      } finally {
        setStreaming(false);
      }
    },
    [getAccessToken, streaming],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setStreaming(false);
  }, []);

  return { messages, sendMessage, streaming, reset };
}
