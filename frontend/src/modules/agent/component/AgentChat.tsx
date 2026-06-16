"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  Check,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePrivy } from "@privy-io/react-auth";
import { useChat, type ChatCard } from "@/hooks/useChat";
import { useHoldings } from "@/hooks/useHoldings";
import { tokenColor } from "@/components/elements/TokenIcon";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/* ──────────────────────────────────────────────────────────
   Agent Chat — Tends
   Sessions sidebar · Ask · Inspect · Act · slash commands
   ────────────────────────────────────────────────────────── */

// ─── Slash commands ─────────────────────────────────────────

const SLASH = [
  { cmd: "/deposit", desc: "Add funds to your vault", group: "Actions", needsArgs: true },
  { cmd: "/withdraw", desc: "Withdraw funds", group: "Actions", needsArgs: true },
  { cmd: "/move", desc: "Move allocation between assets", group: "Actions", needsArgs: true },
  { cmd: "/rebalance", desc: "Rebalance now", group: "Actions", needsArgs: false },
  { cmd: "/pause", desc: "Pause the agent", group: "Agent", needsArgs: false },
  { cmd: "/resume", desc: "Resume the agent", group: "Agent", needsArgs: false },
  { cmd: "/status", desc: "Agent status + portfolio", group: "Inspect", needsArgs: false },
  { cmd: "/holdings", desc: "Your current holdings", group: "Inspect", needsArgs: false },
  { cmd: "/performance", desc: "APY & performance", group: "Inspect", needsArgs: false },
  { cmd: "/explain", desc: "Explain your strategy", group: "Inspect", needsArgs: false },
  { cmd: "/strategy", desc: "Change risk strategy", group: "Settings", needsArgs: true },
  { cmd: "/note", desc: "Leave a note for the agent", group: "Settings", needsArgs: true },
];

const SUGGESTIONS = [
  "How's my money doing?",
  "Which strategy fits me?",
  "Explain what you're doing",
  "Move some cmETH into stable yield",
];

// ─── Rich cards ─────────────────────────────────────────────

function HoldingsCard({ data }: { data?: Extract<ChatCard, { type: "holdings" }> }) {
  const live = useHoldings();
  // Prefer the snapshot the agent streamed; fall back to the live query.
  const holdings = data?.holdings ?? live.holdings;
  const totalValueUSD = data ? Number(data.totalValueUsd) : live.totalValueUSD;
  const isLoading = !data && live.isLoading;

  if (isLoading) {
    return (
      <div className="mt-2 w-full max-w-sm rounded-xl border border-edge bg-card p-3 text-xs text-dim">
        Loading your holdings...
      </div>
    );
  }
  if (holdings.length === 0) {
    return (
      <div className="mt-2 w-full max-w-sm rounded-xl border border-edge bg-card p-3 text-xs text-dim">
        No holdings yet. Make a first deposit to get started.
      </div>
    );
  }
  return (
    <div className="mt-2 w-full max-w-sm rounded-xl border border-edge bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink">Your holdings</span>
        <span className="text-sm font-semibold text-ink">{fmtUsd(totalValueUSD)}</span>
      </div>
      <div className="space-y-2">
        {holdings.map((h) => (
          <div key={h.symbol} className="flex items-center gap-2">
            <span className="w-12 text-xs font-medium text-ink">{h.symbol}</span>
            <div className="h-1.5 flex-1 rounded-[2px] bg-panel">
              <div
                className="h-1.5 rounded-[2px]"
                style={{ background: tokenColor(h.symbol), width: `${Math.min(100, h.allocationPct)}%` }}
              />
            </div>
            <span className="w-8 text-right text-[10px] text-dim">{Math.round(h.allocationPct)}%</span>
            <span className="w-14 text-right text-xs font-medium text-ink">{fmtUsd(Number(h.valueUsd))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ card }: { card: Extract<ChatCard, { type: "action" }> }) {
  const { getAccessToken } = usePrivy();
  const [state, setState] = useState<"proposed" | "executing" | "done" | "error" | "cancelled">("proposed");
  const [hash, setHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const icon = {
    move: <Sparkles className="h-4 w-4" />,
    deposit: <ArrowDownLeft className="h-4 w-4" />,
    withdraw: <ArrowUpRight className="h-4 w-4" />,
  }[card.kind];

  // Confirm = execute the proposed swap on-chain via the backend (agent-signed).
  const confirm = async () => {
    setState("executing");
    setErr(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/me/chat/confirm-swap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(card.proposal),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErr(data.reason ?? data.error ?? "Swap failed.");
        setState("error");
        return;
      }
      setHash(data.hash ?? null);
      setState("done");
    } catch {
      setErr("Swap failed. Try again.");
      setState("error");
    }
  };

  return (
    <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-edge bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{card.title}</p>
          <p className="text-[11px] text-dim">{card.subtitle}</p>
        </div>
      </div>

      {state === "proposed" && (
        <div className="flex border-t border-edge">
          <button
            onClick={() => setState("cancelled")}
            className="flex-1 py-2.5 text-xs font-medium text-dim transition-colors hover:bg-panel"
          >
            Cancel
          </button>
          <div className="w-px bg-panel" />
          <button
            onClick={confirm}
            className="flex-1 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            Confirm
          </button>
        </div>
      )}
      {state === "executing" && (
        <div className="flex items-center justify-center gap-2 border-t border-edge py-2.5 text-xs font-medium text-brand">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing on-chain...
        </div>
      )}
      {state === "done" && (
        <div className="flex items-center justify-center gap-1.5 border-t border-edge bg-pos-soft py-2.5 text-xs font-medium text-pos">
          <Check className="h-3.5 w-3.5" /> Done
          {hash ? ` · ${hash.slice(0, 6)}…${hash.slice(-4)}` : ""}
        </div>
      )}
      {state === "error" && (
        <div className="border-t border-edge bg-neg-soft px-3 py-2.5 text-xs font-medium text-neg">
          {err ?? "Swap failed."}
        </div>
      )}
      {state === "cancelled" && (
        <div className="flex items-center justify-center border-t border-edge py-2.5 text-xs font-medium text-faint">
          Cancelled
        </div>
      )}
    </div>
  );
}

// ─── Message model ──────────────────────────────────────────

type Msg = {
  id: number;
  role: "user" | "agent";
  text?: React.ReactNode;
  card?: ChatCard;
};

// ─── Slash menu ─────────────────────────────────────────────

type SlashItem = (typeof SLASH)[number];

function SlashMenu({
  items,
  activeIndex,
  onPick,
  onHover,
}: {
  items: SlashItem[];
  activeIndex: number;
  onPick: (cmd: string) => void;
  onHover: (i: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (items.length === 0) return null;
  const groups = [...new Set(items.map((s) => s.group))];

  return (
    <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-edge bg-card p-1 shadow-lg shadow-ink/8">
      {groups.map((g, gi) => (
        <div key={g} className={gi > 0 ? "mt-1 border-t border-edge pt-1" : ""}>
          <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-faint">{g}</p>
          {items
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => s.group === g)
            .map(({ s, idx }) => (
              <button
                key={s.cmd}
                ref={idx === activeIndex ? activeRef : undefined}
                onClick={() => onPick(s.cmd)}
                onMouseEnter={() => onHover(idx)}
                className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-1.5 text-left transition-colors ${
                  idx === activeIndex ? "bg-brand-soft" : ""
                }`}
              >
                <span className="font-mono text-xs font-semibold text-brand">{s.cmd}</span>
                <span className="truncate text-xs text-dim">{s.desc}</span>
              </button>
            ))}
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t border-edge px-3 py-1.5 text-[9px] text-faint">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc dismiss</span>
      </div>
    </div>
  );
}

// ─── Agent message ───────────────────────────────────────────

function AgentMessage({
  text,
  card,
  streaming,
  onTick,
}: {
  text: string;
  card?: Msg["card"];
  streaming?: boolean;
  onTick?: () => void;
}) {
  useEffect(() => {
    onTick?.();
  }, [text, onTick]);

  return (
    <>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {text}
        {streaming && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse rounded-[1px] bg-brand align-middle" />
        )}
      </p>
      {card && (
        <div style={{ animation: "fadeIn .3s ease" }}>
          {card.type === "holdings" && <HoldingsCard data={card} />}
          {card.type === "action" && <ActionCard card={card} />}
        </div>
      )}
    </>
  );
}

// ─── Sessions sidebar ────────────────────────────────────────

interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

function formatRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SessionsList({
  sessions,
  activeId,
  onSelect,
  onDelete,
  deletingId,
}: {
  sessions: Session[];
  activeId: string | null;
  onSelect: (s: Session) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  deletingId: string | null;
}) {
  return (
    <div className="flex flex-col">
      <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-faint">
        History
      </p>
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-[11px] text-faint">
            No past chats yet. Start one above.
          </p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            className={`group relative flex cursor-pointer items-start gap-2 rounded-xl px-3 py-2 transition-colors ${
              activeId === s.id
                ? "bg-brand-soft"
                : "hover:bg-panel"
            }`}
          >
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-faint" />
            <div className="min-w-0 flex-1 pr-4">
              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-ink">
                {s.title}
              </p>
              <p className="mt-0.5 text-[10px] text-faint">{formatRelativeTime(s.updatedAt)}</p>
            </div>
            <button
              onClick={(e) => onDelete(s.id, e)}
              disabled={deletingId === s.id}
              className="absolute right-2 top-2 hidden rounded p-0.5 text-faint transition-colors hover:text-red-500 group-hover:block"
              title="Delete"
            >
              {deletingId === s.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────

export function AgentChat() {
  const { messages: hookMessages, sendMessage, streaming, status, threadId, newChat, loadThread } =
    useChat();
  const { getAccessToken } = usePrivy();
  const [input, setInput] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prevStreaming = useRef(streaming);
  const wrapRef = useRef<HTMLDivElement>(null);

  const messages: Msg[] = hookMessages.map((m, i) => ({
    id: i,
    role: m.role === "hermes" ? "agent" : "user",
    text: m.text,
    card: m.card,
  }));

  // ── Sessions fetching ──────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat-sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { sessions: Session[] };
        setSessions(data.sessions ?? []);
      }
    } catch {
      // non-critical
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Re-fetch after a stream completes so newly created sessions appear in sidebar.
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      void fetchSessions();
    }
    prevStreaming.current = streaming;
  }, [streaming, fetchSessions]);

  // Mobile: size the chat to the real visible space via the visual viewport
  // (iOS Safari shrinks visualViewport — not dvh — when the keyboard opens, so
  // CSS alone can't hug it). Reserve main's bottom padding (the nav clearance,
  // which the kb-open rule zeroes while typing) so it never double-counts.
  //
  // KEY: getBoundingClientRect().top is in LAYOUT-viewport coordinates (doesn't
  // shrink), while visualViewport.height is the VISIBLE height. When iOS scrolls
  // the page to reveal the focused input, top drifts (even negative) and the two
  // no longer line up — the container balloons, the page scrolls, and the sticky
  // composer unsticks into empty space. Subtracting visualViewport.offsetTop puts
  // top back into visible-viewport space so the two move together and stay exact.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      if (window.innerWidth >= 768) {
        el.style.height = "";
        return;
      }
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      const top = Math.max(0, el.getBoundingClientRect().top - offsetTop);
      const main = el.closest("main");
      const pad = main
        ? parseFloat(getComputedStyle(main).paddingBottom) || 0
        : 0;
      el.style.height = `${Math.max(160, vh - top - pad)}px`;
    };
    const soon = () => requestAnimationFrame(measure);
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    document.addEventListener("focusin", soon);
    document.addEventListener("focusout", soon);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", soon);
      document.removeEventListener("focusout", soon);
    };
  }, []);

  // ── Session actions ────────────────────────────────────────

  async function handleSelectSession(s: Session) {
    if (streaming) return;
    setActiveSession(s.id);
    await loadThread(s.id);
  }

  function handleNewChat() {
    newChat();
    setActiveSession(null);
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const token = await getAccessToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat-sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession === id) {
        newChat();
        setActiveSession(null);
      }
    } finally {
      setDeletingId(null);
    }
  }

  // ── Chat helpers ───────────────────────────────────────────

  const showSlash = input.startsWith("/");
  const slashItems = showSlash ? SLASH.filter((s) => s.cmd.startsWith(input.toLowerCase())) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [hookMessages, streaming]);

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text) return;
    // When the user sends the first message in a new chat, mark it as active session
    if (!activeSession) setActiveSession(threadId);
    setInput("");
    void sendMessage(text);
  }

  function pickCommand(cmd: string) {
    const item = SLASH.find((s) => s.cmd === cmd);
    if (item?.needsArgs) {
      setInput(cmd + " ");
      taRef.current?.focus();
    } else {
      send(cmd);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlash && slashItems.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pickCommand(slashItems[slashIndex].cmd);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const empty = messages.length === 0;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div ref={wrapRef} className="relative flex min-h-[calc(100dvh-17rem)] flex-col">
      {/* Sticky top bar: New chat + History stay reachable in a long conversation
          (mirrors the sticky composer at the bottom). The bg-app strip masks
          messages scrolling underneath. History floats OVER the chat from here,
          so it never steals body width AND follows the bar on scroll. */}
      <div className="sticky top-0 z-30 mb-2 hidden bg-app md:block">
        <div className="relative flex items-center gap-1.5 py-1">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
              sidebarOpen
                ? "bg-panel text-dim"
                : "text-faint hover:bg-panel hover:text-dim"
            }`}
          >
            <History className="h-3.5 w-3.5" /> History
          </button>

          <AnimatePresence>
            {sidebarOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  style={{ transformOrigin: "top left" }}
                  className="absolute left-0 top-full z-20 mt-1 w-64 rounded-2xl border-[1.25px] border-edge bg-card p-1.5 shadow-xl shadow-[#0C1A2B]/10"
                >
                  <SessionsList
                    sessions={sessions}
                    activeId={activeSession}
                    onSelect={(s) => {
                      void handleSelectSession(s);
                      setSidebarOpen(false);
                    }}
                    onDelete={(id, e) => void handleDeleteSession(id, e)}
                    deletingId={deletingId}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main chat area — always full width */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* messages — flow with the page, no inner scrollbar */}
        <div className="flex-1">
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon/White-Tends.svg" alt="Tends Agent" className="h-6 w-auto" />
              </div>
              <p className="mt-4 text-base font-semibold text-ink">
                Watching the market for you. Ask me anything.
              </p>
              <p className="mt-1 text-xs text-dim">
                Ask about your money, or tell me to make a move. Type{" "}
                <span className="font-mono text-brand">/</span> for shortcuts.
              </p>
              <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-edge bg-card px-3 py-1.5 text-xs text-dim transition-colors hover:border-brand hover:text-brand"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-6">
              {messages.map((m, idx) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white dark:bg-white/10">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/icon/White-Tends.svg" alt="Tends Agent" className="h-3.5 w-auto" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <AgentMessage
                        text={typeof m.text === "string" ? m.text : ""}
                        card={m.card}
                        streaming={streaming && idx === messages.length - 1}
                        onTick={() => endRef.current?.scrollIntoView({ block: "end" })}
                      />
                    </div>
                  </div>
                ),
              )}
              {streaming && messages[messages.length - 1]?.role !== "agent" && (
                <div className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon/White-Tends.svg" alt="Tends Agent" className="h-3.5 w-auto" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-panel px-3 py-3">
                    {status ? (
                      // a tool is running — show what it's doing instead of the dots
                      <span className="text-xs text-dim">
                        {status}
                        <span className="ml-0.5 inline-block animate-pulse">…</span>
                      </span>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint" />
                      </>
                    )}
                  </div>
                </div>
              )}
              <div ref={endRef} style={{ scrollMarginBottom: "6rem" }} />
            </div>
          )}
        </div>

        {/* composer — sticky to the viewport bottom while the page scrolls */}
        <div className="sticky bottom-0 bg-app pb-3 pt-2">
          {/* fade scrim */}
          <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-app to-transparent" />
          <div className="relative">
            {showSlash && (
              <SlashMenu items={slashItems} activeIndex={slashIndex} onPick={pickCommand} onHover={setSlashIndex} />
            )}
            <div className="flex items-end gap-2 rounded-full border border-edge bg-card px-4 py-2 shadow-sm transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/20">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSlashIndex(0);
                }}
                onKeyDown={onKey}
                rows={1}
                placeholder="Ask anything, or type / for commands"
                className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-faint"
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-faint">
            Tends Agent can make mistakes. Review actions before you confirm.
          </p>
        </div>
      </div>
    </div>
  );
}
