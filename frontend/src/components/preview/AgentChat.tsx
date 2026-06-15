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
    <div className="mt-2 w-full max-w-sm rounded-xl border border-edge bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink">Your holdings</span>
        <span className="text-sm font-semibold text-ink">$12,430.50</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.sym} className="flex items-center gap-2">
            <span className="w-12 text-xs font-medium text-ink">{r.sym}</span>
            <div className="h-1.5 flex-1 rounded-[2px] bg-panel">
              <div className="h-1.5 rounded-[2px]" style={{ background: r.bar, width: r.w }} />
            </div>
            <span className="w-8 text-right text-[0.625rem] text-dim">{r.pct}%</span>
            <span className="w-14 text-right text-xs font-medium text-ink">{r.val}</span>
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
    <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-edge bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{config.title}</p>
          <p className="text-[0.6875rem] text-dim">{config.sub}</p>
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
            onClick={() => {
              setState("executing");
              setTimeout(() => setState("done"), 2200);
            }}
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
    <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-xl border border-edge bg-card p-1 shadow-lg shadow-[#0C1A2B]/8">
      {groups.map((g, gi) => (
        <div key={g} className={gi > 0 ? "mt-1 border-t border-edge pt-1" : ""}>
          <p className="px-3 pb-1 pt-1.5 text-[0.5625rem] font-semibold uppercase tracking-widest text-faint">{g}</p>
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
      <div className="mt-1 flex items-center gap-2 border-t border-edge px-3 py-1.5 text-[0.5625rem] text-faint">
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
      <p className="text-sm leading-relaxed text-ink">
        {shown}
        {!done && <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse rounded-[1px] bg-brand align-middle" />}
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
  const wrapRef = useRef<HTMLDivElement>(null);

  const showSlash = input.startsWith("/");
  const slashItems = showSlash ? SLASH.filter((s) => s.cmd.startsWith(input.toLowerCase())) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

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
    <div
      ref={wrapRef}
      className="mx-auto flex max-w-3xl flex-col md:min-h-[calc(100dvh-17rem)]"
    >
      {/* messages — scroll inside (JS-sized container) on mobile */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto md:overflow-visible">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon/White-Tends.svg" alt="Tends Agent" className="h-6 w-auto" />
            </div>
            <p className="mt-4 text-base font-semibold text-ink">
              How can I help with your portfolio?
            </p>
            <p className="mt-1 text-xs text-dim">
              Ask a question, or tell me to move funds. Type{" "}
              <span className="font-mono text-brand">/</span> for commands.
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
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-tip px-4 py-2.5 text-sm text-white">
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
                      onTick={() => endRef.current?.scrollIntoView({ block: "end" })}
                    />
                  </div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon/White-Tends.svg" alt="Tends Agent" className="h-3.5 w-auto" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-panel px-3 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint" />
                </div>
              </div>
            )}
            <div ref={endRef} style={{ scrollMarginBottom: "6rem" }} />
          </div>
        )}
      </div>

      {/* composer — sticky to the viewport bottom while the page scrolls */}
      <div className="sticky bottom-0 bg-app pb-3 pt-2">
        {/* fade scrim: messages dissolve into the canvas above the bar */}
        <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-linear-to-t from-app to-transparent" />
        <div className="relative">
          {showSlash && (
            <SlashMenu items={slashItems} activeIndex={slashIndex} onPick={pickCommand} onHover={setSlashIndex} />
          )}
          <div className="flex items-end gap-2 rounded-full border border-edge bg-card px-4 py-2 shadow-sm transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-[#1591DC]/20">
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
        <p className="mt-2 text-center text-[0.625rem] text-faint">
          Tends Agent can make mistakes. Review actions before you confirm.
        </p>
      </div>
    </div>
  );
}
