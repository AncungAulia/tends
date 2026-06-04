"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Check, X, Loader2, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Agent Chat — Tends
   Ask · Inspect · Act · slash commands · action confirmation
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
  "How's my portfolio doing?",
  "Move 30% of cmETH into sUSDe",
  "Explain my strategy",
  "/holdings",
];

// ─── Rich cards ─────────────────────────────────────────────

function HoldingsCard() {
  const rows = [
    { sym: "cmETH", pct: 40, val: "$4,972", bar: "#2C5EAD", w: "80%" },
    { sym: "sUSDe", pct: 35, val: "$4,351", bar: "#1591DC", w: "70%" },
    { sym: "USDC", pct: 25, val: "$3,107", bar: "#4BB8FA", w: "50%" },
  ];
  return (
    <div className="mt-2 w-full max-w-sm rounded-xl border border-[#DDE8F2] bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-[#0C1A2B]">Your holdings</span>
        <span className="text-sm font-semibold text-[#0C1A2B]">$12,430.50</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.sym} className="flex items-center gap-2">
            <span className="w-12 text-xs font-medium text-[#0C1A2B]">{r.sym}</span>
            <div className="h-1.5 flex-1 rounded-[2px] bg-[#F0F4F8]">
              <div className="h-1.5 rounded-[2px]" style={{ background: r.bar, width: r.w }} />
            </div>
            <span className="w-8 text-right text-[10px] text-[#5B7490]">{r.pct}%</span>
            <span className="w-14 text-right text-xs font-medium text-[#0C1A2B]">{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ kind }: { kind: "move" | "deposit" | "withdraw" }) {
  const [state, setState] = useState<"proposed" | "executing" | "done" | "cancelled">("proposed");

  const config = {
    move: { icon: <Sparkles className="h-4 w-4" />, title: "Move 30% cmETH → sUSDe", sub: "≈ $1,491 · new: cmETH 28% · sUSDe 47%" },
    deposit: { icon: <ArrowDownLeft className="h-4 w-4" />, title: "Deposit 500 USDC", sub: "Added to your vault, agent will allocate" },
    withdraw: { icon: <ArrowUpRight className="h-4 w-4" />, title: "Withdraw 500 USDC", sub: "Sent back to your wallet" },
  }[kind];

  return (
    <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-[#DDE8F2] bg-white">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF4FC] text-[#1591DC]">
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0C1A2B]">{config.title}</p>
          <p className="text-[11px] text-[#5B7490]">{config.sub}</p>
        </div>
      </div>

      {state === "proposed" && (
        <div className="flex border-t border-[#F0F4F8]">
          <button
            onClick={() => setState("cancelled")}
            className="flex-1 py-2.5 text-xs font-medium text-[#5B7490] transition-colors hover:bg-[#F7F9FC]"
          >
            Cancel
          </button>
          <div className="w-px bg-[#F0F4F8]" />
          <button
            onClick={() => {
              setState("executing");
              setTimeout(() => setState("done"), 2200);
            }}
            className="flex-1 py-2.5 text-xs font-semibold text-[#1591DC] transition-colors hover:bg-[#EAF4FC]"
          >
            Confirm
          </button>
        </div>
      )}
      {state === "executing" && (
        <div className="flex items-center justify-center gap-2 border-t border-[#F0F4F8] py-2.5 text-xs font-medium text-[#1591DC]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Executing on-chain...
        </div>
      )}
      {state === "done" && (
        <div className="flex items-center justify-center gap-1.5 border-t border-[#F0F4F8] bg-green-50 py-2.5 text-xs font-medium text-green-700">
          <Check className="h-3.5 w-3.5" /> Done
        </div>
      )}
      {state === "cancelled" && (
        <div className="flex items-center justify-center border-t border-[#F0F4F8] py-2.5 text-xs font-medium text-[#94A3B8]">
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
  card?: "holdings" | "move" | "deposit" | "withdraw";
};

let nextId = 1;

function buildReply(input: string): Omit<Msg, "id" | "role"> {
  const t = input.toLowerCase().trim();
  if (t.startsWith("/move") || t.includes("move") || t.includes("shift") || t.includes("pindah")) {
    return { text: "Here's what I'd do. Review and confirm whenever you're ready.", card: "move" };
  }
  if (t.startsWith("/deposit")) return { text: "Sure, here's the deposit ready to confirm.", card: "deposit" };
  if (t.startsWith("/withdraw")) return { text: "Here's the withdrawal, confirm to send it back to your wallet.", card: "withdraw" };
  if (t.startsWith("/holdings") || t.includes("holding") || t.includes("portfolio") || t.includes("how")) {
    return { text: "You're up +2.31% all time. Here's the breakdown:", card: "holdings" };
  }
  if (t.startsWith("/status")) return { text: "Agent is active and monitoring. Next run in about 18 minutes. 47 rebalances so far, est. APY 8.4%." };
  if (t.startsWith("/explain") || t.includes("strategy") || t.includes("explain")) {
    return { text: "You're on the Medium strategy. I keep a balanced mix across cmETH, sUSDe, and USDC, leaning toward stable yield when volatility climbs. Right now that's cmETH 40%, sUSDe 35%, USDC 25%." };
  }
  if (t.startsWith("/pause")) return { text: "I've paused. I won't manage your portfolio until you resume me." };
  if (t.startsWith("/resume")) return { text: "Back on. I'll keep watching and rebalance when it makes sense." };
  return { text: "I can answer questions about your portfolio, explain your strategy, or move funds for you. Try typing / to see what I can do." };
}

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
    <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-[#DDE8F2] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8">
      {groups.map((g, gi) => (
        <div key={g} className={gi > 0 ? "mt-1 border-t border-[#F0F4F8] pt-1" : ""}>
          <p className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-[#94A3B8]">{g}</p>
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
                  idx === activeIndex ? "bg-[#EAF4FC]" : ""
                }`}
              >
                <span className="font-mono text-xs font-semibold text-[#1591DC]">{s.cmd}</span>
                <span className="truncate text-xs text-[#5B7490]">{s.desc}</span>
              </button>
            ))}
        </div>
      ))}
      <div className="mt-1 flex items-center gap-2 border-t border-[#F0F4F8] px-3 py-1.5 text-[9px] text-[#94A3B8]">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc dismiss</span>
      </div>
    </div>
  );
}

// ─── Agent message (typewriter + delayed card) ──────────────

function AgentMessage({
  text,
  card,
  onTick,
  instant,
}: {
  text: string;
  card?: Msg["card"];
  onTick?: () => void;
  instant?: boolean;
}) {
  const [shown, setShown] = useState(instant ? text : "");
  const [done, setDone] = useState(!!instant);

  useEffect(() => {
    if (instant) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      onTick?.();
      if (i >= text.length) {
        clearInterval(id);
        setShown(text);
        setDone(true);
        onTick?.();
      }
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <p className="text-sm leading-relaxed text-[#0C1A2B]">
        {shown}
        {!done && <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-[1px] bg-[#1591DC] align-middle" />}
      </p>
      {done && card && (
        <div style={{ animation: "fadeIn .3s ease" }}>
          {card === "holdings" && <HoldingsCard />}
          {(card === "move" || card === "deposit" || card === "withdraw") && <ActionCard kind={card} />}
        </div>
      )}
    </>
  );
}

// ─── Main ───────────────────────────────────────────────────

export function AgentChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const showSlash = input.startsWith("/");
  const slashItems = showSlash ? SLASH.filter((s) => s.cmd.startsWith(input.toLowerCase())) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text) return;
    setMessages((m) => [...m, { id: nextId++, role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: nextId++, role: "agent", ...buildReply(text) }]);
    }, 900);
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

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-17rem)] max-w-3xl flex-col">
      {/* messages — flow with the page, no inner scrollbar */}
      <div className="flex-1">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1591DC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon/tends-white.svg" alt="Tends Agent" className="h-6 w-auto" />
            </div>
            <p className="mt-4 text-base font-semibold text-[#0C1A2B]">
              How can I help with your portfolio?
            </p>
            <p className="mt-1 text-xs text-[#5B7490]">
              Ask a question, or tell me to move funds. Type{" "}
              <span className="font-mono text-[#1591DC]">/</span> for commands.
            </p>
            <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-[#E8EAEC] bg-white px-3 py-1.5 text-xs text-[#5B7490] transition-colors hover:border-[#1591DC] hover:text-[#1591DC]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-6">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0C1A2B] px-4 py-2.5 text-sm text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1591DC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icon/tends-white.svg" alt="Tends Agent" className="h-3.5 w-auto" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <AgentMessage
                      text={typeof m.text === "string" ? m.text : ""}
                      card={m.card}
                      onTick={() => endRef.current?.scrollIntoView({ block: "end" })}
                    />
                  </div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1591DC]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon/tends-white.svg" alt="Tends Agent" className="h-3.5 w-auto" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-[#F7F9FC] px-3 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94A3B8] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94A3B8] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#94A3B8]" />
                </div>
              </div>
            )}
            <div ref={endRef} style={{ scrollMarginBottom: "6rem" }} />
          </div>
        )}
      </div>

      {/* composer — sticky to the viewport bottom while the page scrolls */}
      <div className="sticky bottom-0 bg-[#F9FBFC] pb-3 pt-2">
        {/* fade scrim: messages dissolve into the canvas above the bar */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-[#F9FBFC] to-transparent" />
        <div className="relative">
          {showSlash && (
            <SlashMenu items={slashItems} activeIndex={slashIndex} onPick={pickCommand} onHover={setSlashIndex} />
          )}
          <div className="flex items-end gap-2 rounded-full border border-[#E8EAEC] bg-white px-4 py-2 shadow-sm transition-colors focus-within:border-[#1591DC] focus-within:ring-1 focus-within:ring-[#1591DC]/20">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSlashIndex(0);
              }}
              onKeyDown={onKey}
              rows={1}
              placeholder="Message Tends Agent, or type / for commands"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-[#0C1A2B] outline-none placeholder:text-[#94A3B8]"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1591DC] text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-[#94A3B8]">
          Tends Agent can make mistakes. Review actions before you confirm.
        </p>
      </div>
    </div>
  );
}
