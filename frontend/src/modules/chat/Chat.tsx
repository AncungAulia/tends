"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import makeBlockie from "ethereum-blockies-base64";
import { Send, X, Maximize2, Minimize2, Plus } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { useChatStore } from "@/hooks/useChatStore";
import { Spinner } from "@/components/elements/Spinner";
import { Markdown } from "@/components/elements/Markdown";
import { cn } from "@/utils/cn";

interface ChatProps {
  onClose: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}

const SUGGESTIONS = [
  "What's in my vault?",
  "Explain my strategy",
  "How is my portfolio doing?",
];

export function Chat({ onClose, expanded, onToggleExpand }: ChatProps) {
  const { messages, sendMessage, streaming, reset } = useChat();
  const { address } = useAccount();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const { consumePending } = useChatStore();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const pending = consumePending();
    if (pending) sendMessage(pending);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (text: string) => {
    if (!text.trim() || streaming) return;
    sendMessage(text);
    setInput("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const empty = messages.length === 0;

  const Conversation = (
    <div className={cn("space-y-4 p-4", expanded && "mx-auto w-full max-w-2xl py-8")}>
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        const streamingEmpty =
          !isUser && streaming && i === messages.length - 1 && m.text === "";
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2.5",
              isUser ? "flex-row-reverse" : "flex-row",
            )}
          >
            {/* Mini avatar — blockies for the user, blue placeholder for Tends Agent */}
            {isUser ? (
              address ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={makeBlockie(address)}
                  alt=""
                  aria-hidden="true"
                  className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
                />
              ) : (
                <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[#0C1A2B] dark:bg-white" />
              )
            ) : (
              <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[#1591DC]" />
            )}

            {streamingEmpty ? (
              // Typing loader — original CSS untouched; only repositioned:
              //  · ml offsets the left dot (overflows ~3.5em) → gap matches the bubble
              //  · -mt lifts the element so its dots (rendered 2.5em below) center on the avatar
              <span
                className="tends-typing ml-[18px] -mt-[3px]"
                role="status"
                aria-label="Tends Agent is typing"
              />
            ) : (
              // Bubble — fits its content; corner toward the avatar is squared
              <div
                className={cn(
                  "w-fit max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                  isUser
                    ? "whitespace-pre-wrap rounded-tr-none bg-[#0C1A2B] text-white dark:bg-white dark:text-[#0C1A2B]"
                    : "rounded-tl-none bg-[#F7F9FC] text-[#0C1A2B] dark:bg-white/5 dark:text-white",
                )}
              >
                {isUser ? m.text : <Markdown>{m.text}</Markdown>}
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );

  return (
    <div
      className={cn(
        "z-40 flex flex-col overflow-hidden bg-white dark:bg-[#0F2035]",
        expanded
          ? // Full content area (right of the sidebar), no shadow so it never
            // bleeds over the sidebar.
            "fixed inset-y-0 right-0 left-0 border-l border-[#DDE8F2] dark:border-white/10 md:left-60"
          : "fixed bottom-4 right-4 h-[28rem] w-[min(95vw,22rem)] rounded-2xl border border-[#DDE8F2] shadow-2xl dark:border-white/10 max-md:bottom-20",
      )}
    >
      <header className="flex items-center justify-between border-b border-[#DDE8F2] px-4 py-3 dark:border-white/10">
        <span className="font-sans text-sm font-semibold text-[#0C1A2B] dark:text-white">
          Tends Agent
        </span>
        <div className="flex items-center gap-3 text-[#5B7490] dark:text-white/45">
          {expanded && !empty && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE8F2] px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-[0.04em] transition-colors hover:border-[#0C1A2B] hover:text-[#0C1A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC]/40 dark:border-white/10 dark:hover:text-white"
            >
              <Plus size={13} />
              New chat
            </button>
          )}
          <button
            onClick={onToggleExpand}
            aria-label={expanded ? "Shrink chat" : "Expand chat"}
            className="hover:text-[#0C1A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC]/40 dark:hover:text-white"
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="hover:text-[#0C1A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC]/40 dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {empty ? (
          expanded ? (
            // Gemini / Claude-style centered hero
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <h2 className="max-w-xl font-sans text-3xl font-bold tracking-[-0.02em] text-[#0C1A2B] dark:text-white sm:text-4xl">
                Your AI portfolio manager
              </h2>
              <p className="mt-3 max-w-md text-[#5B7490] dark:text-white/45">
                Ask Tends Agent about your vault, strategy, or holdings.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[#DDE8F2] px-4 py-2 text-sm text-[#0C1A2B] transition-colors hover:border-[#1591DC] hover:text-[#1591DC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC]/40 dark:border-white/10 dark:text-white/70 dark:hover:border-[#4BB8FA] dark:hover:text-[#4BB8FA]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="p-4 font-sans text-sm text-[#5B7490] dark:text-white/45">
              Hello — I&apos;m Tends Agent, your AI portfolio manager. Ask me about
              your vault, strategies, or holdings.
            </p>
          )
        ) : (
          Conversation
        )}
      </div>

      <form
        onSubmit={submit}
        className={cn(
          "border-t border-[#DDE8F2] dark:border-white/10",
          expanded ? "px-6 py-4" : "p-3",
        )}
      >
        <div className={cn("flex items-center gap-2", expanded && "mx-auto w-full max-w-2xl")}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Message Tends Agent..."
            className={cn(
              "flex-1 rounded-xl border border-[#DDE8F2] bg-white outline-none focus:border-[#1591DC] disabled:opacity-50 dark:border-white/10 dark:bg-[#0C1A2B] dark:text-white",
              expanded ? "px-4 py-3 text-sm" : "px-3 py-2 text-sm",
            )}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className={cn(
              "flex items-center justify-center rounded-xl bg-[#1591DC] text-white transition-opacity disabled:opacity-40",
              expanded ? "h-11 w-11" : "h-9 w-9",
            )}
          >
            {streaming ? <Spinner size="sm" className="text-white" /> : <Send size={expanded ? 18 : 16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
