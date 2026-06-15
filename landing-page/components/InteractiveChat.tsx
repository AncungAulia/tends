"use client";

import { useEffect, useRef, useState } from "react";
import TendsBotFace from "./TendsBotFace";
import ConfirmFace from "./ConfirmFace";

/* The guided, interactive chat. It fills the card and drives the whole beat:

   1. Home view: greeting + composer. The send button glows and reacts to the
      cursor - the visitor must click it (there is nothing to type).
   2. On click: onStart() fires (the parent expands the card), then the agent
      "types" the first prompt, sends it, shows a thinking loader for a beat, and
      streams the answer out one character at a time. Same for the second prompt.
   3. The action card resolves itself: a virtual cursor glides up from the bottom
      of the card, presses Approve, and onComplete() fires (parent unlocks).

   The whole thing plays like a short video; the page stays locked until it ends.
   No em-dashes in copy. */

const NAVY = "#0C1A2B";
const BLUE = "#1591DC";
const MUTED = "#5B7490";
const FAINT = "#94A3B8";
const EDGE = "#DDE8F2";
const SANS = "var(--font-sans)";

const PROMPT_1 = "How's my money doing?";
const PROMPT_2 = "Move 30% of cmETH into sUSDe";
const HOLDINGS_TEXT = "You're up +2.31% all time. Here's the breakdown:";
const ACTION_TEXT = "Here's what I'd do. Approve it or decline.";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; kind: "holdings" | "action"; shown: number; card: boolean };

function Avatar() {
  return (
    <div style={{ marginTop: 2, width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: "#EAF4FC", overflow: "hidden", boxSizing: "border-box", padding: 3 }}>
      <TendsBotFace variant="medium" active={false} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="chat-msg-in" style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{ maxWidth: "80%", background: NAVY, color: "#fff", fontFamily: SANS, fontSize: 14, lineHeight: 1.45, borderRadius: 16, borderBottomRightRadius: 5, padding: "10px 16px" }}>
        {text}
      </div>
    </div>
  );
}

function AgentText({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.55, color: NAVY, margin: 0 }}>{children}</p>;
}

// Holdings line: plain while streaming, then the +2.31% pops in green once done.
function HoldingsText({ shown }: { shown: number }) {
  if (shown >= HOLDINGS_TEXT.length) {
    return (
      <AgentText>
        You&apos;re up <span style={{ color: "#15803d", fontWeight: 600 }}>+2.31%</span> all time. Here&apos;s the breakdown:
      </AgentText>
    );
  }
  return (
    <AgentText>
      {HOLDINGS_TEXT.slice(0, shown)}
      <span className="caret-blink" />
    </AgentText>
  );
}

function ActionText({ shown }: { shown: number }) {
  const done = shown >= ACTION_TEXT.length;
  return (
    <AgentText>
      {ACTION_TEXT.slice(0, shown)}
      {!done && <span className="caret-blink" />}
    </AgentText>
  );
}

function HoldingsCard() {
  const rows = [
    { sym: "cmETH", pct: 40, val: "$4,972", bar: "#2C5EAD", w: "80%" },
    { sym: "sUSDe", pct: 35, val: "$4,351", bar: "#1591DC", w: "70%" },
    { sym: "USDC", pct: 25, val: "$3,107", bar: "#4BB8FA", w: "50%" },
  ];
  return (
    <div style={{ marginTop: 8, width: "100%", maxWidth: "min(360px, 100%)", borderRadius: 12, border: `1px solid ${EDGE}`, background: "#fff", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: NAVY }}>Your holdings</span>
        <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: NAVY }}>$12,430.50</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.sym} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 46, fontFamily: SANS, fontSize: 12, fontWeight: 500, color: NAVY }}>{r.sym}</span>
            <div style={{ height: 6, flex: 1, borderRadius: 2, background: "#F0F4F8" }}>
              <div style={{ height: 6, borderRadius: 2, background: r.bar, width: r.w }} />
            </div>
            <span style={{ width: 30, textAlign: "right", fontSize: 10, color: MUTED }}>{r.pct}%</span>
            <span style={{ width: 50, textAlign: "right", fontFamily: SANS, fontSize: 12, fontWeight: 500, color: NAVY }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  awaiting,
  result,
  pressed,
  approveRef,
}: {
  awaiting: boolean;
  result: "approved" | "denied" | null;
  pressed: boolean;
  approveRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const state = result ?? "asking";
  const ok = result === "approved";
  return (
    <div style={{ marginTop: 8, width: "100%", maxWidth: "min(360px, 100%)", borderRadius: 12, border: `1px solid ${EDGE}`, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
        <div style={{ flexShrink: 0 }}>
          <ConfirmFace state={state} size={48} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: NAVY, margin: 0 }}>Move 30% cmETH → sUSDe</p>
          <p style={{ fontFamily: SANS, fontSize: 11, color: MUTED, margin: "2px 0 0" }}>≈ $1,491 · new: cmETH 28% · sUSDe 47%</p>
        </div>
      </div>

      {result === null ? (
        <div style={{ display: "flex", borderTop: "1px solid #F0F4F8" }}>
          <div style={{ flex: 1, padding: "11px 0", textAlign: "center", fontFamily: SANS, fontSize: 12, fontWeight: 500, color: MUTED }}>
            Decline
          </div>
          <div style={{ width: 1, background: "#F0F4F8" }} />
          <button
            ref={approveRef}
            type="button"
            tabIndex={-1}
            className={awaiting && !pressed ? "cta-pulse" : undefined}
            style={{
              flex: 1,
              padding: "11px 0",
              fontFamily: SANS,
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
              background: awaiting ? BLUE : "#9DC9E8",
              border: "none",
              cursor: "default",
              transform: pressed ? "scale(0.95)" : "scale(1)",
              filter: pressed ? "brightness(0.9)" : "none",
              transition: "transform 0.14s ease, filter 0.14s ease",
            }}
          >
            Approve
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderTop: "1px solid #F0F4F8",
            background: ok ? "#F0FDF4" : "#FEF2F2",
            padding: "11px 0",
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 600,
            color: ok ? "#15803d" : "#B91C1C",
          }}
        >
          {ok ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )}
          {ok ? "Approved and executing" : "Declined"}
        </div>
      )}
    </div>
  );
}

// Thinking indicator that mirrors the real app: three bouncing dots in a pill.
function LoadingDots() {
  return (
    <div className="chat-msg-in" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Avatar />
      <div style={{ display: "flex", gap: 5, alignItems: "center", borderRadius: 16, background: "#F0F4F8", padding: "12px 14px" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#9DB0C4",
              animation: "chatDotBounce 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// The virtual cursor that drives the auto-approve. Eases up from below the card,
// glides to the Approve button, then presses it (scale + ripple).
function VirtualCursor({ x, y, pressed }: { x: number; y: number; pressed: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 30,
        pointerEvents: "none",
        transform: `translate(${x}px, ${y}px)`,
        transition: "transform 1.2s cubic-bezier(0.5,0,0.2,1)",
        willChange: "transform",
      }}
    >
      <div
        style={{
          position: "relative",
          transform: pressed ? "scale(0.8)" : "scale(1)",
          transition: "transform 0.16s ease",
        }}
      >
        {pressed && (
          <span
            className="cursor-ripple"
            style={{
              position: "absolute",
              left: -16,
              top: -14,
              width: 40,
              height: 40,
              borderRadius: "50%",
              border: `2px solid ${BLUE}`,
              transformOrigin: "center",
            }}
          />
        )}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 3px 5px rgba(12,26,43,0.35))" }}>
          <path d="M5 3l13.5 7.2-6 1.4-2.4 5.8L5 3z" fill={NAVY} stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function InteractiveChat({ onStart, onComplete }: { onStart: () => void; onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [typing, setTyping] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [pressApprove, setPressApprove] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0, pressed: false, visible: false });

  const convoRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const sendBtnRef = useRef<HTMLButtonElement>(null);

  // Keep the latest message in view as the sequence plays (also fires on each
  // streamed character because `messages` is replaced on every tick).
  useEffect(() => {
    const el = convoRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, result, cursor]);

  const handleStart = () => {
    if (started) return;
    setStarted(true);
    onStart();
  };

  // The scripted sequence: type -> send -> think -> stream answer, twice, then
  // the virtual cursor approves on its own.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));

    const typePrompt = async (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        setTyping(text.slice(0, i));
        await wait(34);
      }
    };
    const streamAgent = async (id: string, text: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        setMessages((m) => m.map((x) => (x.id === id && x.role === "agent" ? { ...x, shown: i } : x)));
        await wait(22);
      }
    };
    const revealCard = (id: string) =>
      setMessages((m) => m.map((x) => (x.id === id && x.role === "agent" ? { ...x, card: true } : x)));

    (async () => {
      // ── First exchange: ask, think, stream holdings ──
      await wait(650);
      await typePrompt(PROMPT_1);
      if (cancelled) return;
      await wait(280);
      setTyping("");
      setMessages((m) => [...m, { id: "u1", role: "user", text: PROMPT_1 }]);
      await wait(520);
      setLoading(true);
      await wait(1900); // longer "thinking" beat - this is the heartbeat of the clip
      if (cancelled) return;
      setLoading(false);
      setMessages((m) => [...m, { id: "a1", role: "agent", kind: "holdings", shown: 0, card: false }]);
      await wait(220);
      await streamAgent("a1", HOLDINGS_TEXT);
      if (cancelled) return;
      await wait(260);
      revealCard("a1");
      await wait(1500);

      // ── Second exchange: command, think, stream the proposed action ──
      if (cancelled) return;
      await typePrompt(PROMPT_2);
      if (cancelled) return;
      await wait(280);
      setTyping("");
      setMessages((m) => [...m, { id: "u2", role: "user", text: PROMPT_2 }]);
      await wait(520);
      setLoading(true);
      await wait(2100); // a touch longer - it is "planning a move"
      if (cancelled) return;
      setLoading(false);
      setMessages((m) => [...m, { id: "a2", role: "agent", kind: "action", shown: 0, card: false }]);
      await wait(220);
      await streamAgent("a2", ACTION_TEXT);
      if (cancelled) return;
      await wait(300);
      revealCard("a2");
      await wait(520);
      setAwaiting(true);

      // ── Auto-approve: glide the virtual cursor up and press Approve ──
      await wait(650);
      if (cancelled) return;
      const root = rootRef.current;
      const btn = approveRef.current;
      if (root && btn) {
        const rb = root.getBoundingClientRect();
        const bb = btn.getBoundingClientRect();
        const tx = bb.left - rb.left + bb.width / 2;
        const ty = bb.top - rb.top + bb.height / 2;
        // start just below the card, slightly off-center for a natural arc
        setCursor({ x: rb.width * 0.62, y: rb.height + 56, pressed: false, visible: true });
        await wait(90);
        if (cancelled) return;
        setCursor({ x: tx, y: ty, pressed: false, visible: true }); // eased travel
        await wait(1250);
        if (cancelled) return;
        setCursor((c) => ({ ...c, pressed: true })); // press down
        setPressApprove(true);
        await wait(150);
        if (cancelled) return;
        setResult("approved"); // commit
        setAwaiting(false);
        await wait(180);
        setPressApprove(false);
        setCursor((c) => ({ ...c, pressed: false }));
        await wait(420);
        setCursor((c) => ({ ...c, visible: false }));
      } else {
        setResult("approved");
        setAwaiting(false);
      }

      await wait(950); // let "Approved and executing" land before unlocking
      if (cancelled) return;
      onComplete();
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div ref={rootRef} style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* content: home greeting (fades out) + conversation (fades in) */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {/* home greeting */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            opacity: started ? 0 : 1,
            filter: started ? "blur(8px)" : "blur(0px)",
            transform: started ? "translateY(-16px)" : "translateY(0)",
            transition: "opacity 0.5s ease, filter 0.5s ease, transform 0.55s ease",
            pointerEvents: started ? "none" : "auto",
          }}
        >
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#EAF4FC", overflow: "hidden", boxSizing: "border-box", padding: 11 }}>
            <TendsBotFace variant="medium" active slow />
          </div>
          <p style={{ fontFamily: SANS, fontWeight: 600, fontSize: "clamp(1.35rem, 2.3vw, 1.8rem)", letterSpacing: "-0.02em", color: NAVY, margin: "24px 0 0" }}>
            Watching the market for you. Ask me anything.
          </p>
          <p style={{ fontFamily: SANS, fontSize: "clamp(0.92rem, 1.2vw, 1.05rem)", lineHeight: 1.55, color: MUTED, margin: "12px 0 0", maxWidth: "40ch" }}>
            Ask about your money, or tell me to make a move.
          </p>
        </div>

        {/* conversation */}
        <div
          ref={convoRef}
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "auto",
            padding: "4px 6px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            opacity: started ? 1 : 0,
            transition: "opacity 0.5s ease 0.25s",
            pointerEvents: started ? "auto" : "none",
          }}
        >
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.text} />
            ) : (
              <div key={m.id} className="chat-msg-in" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Avatar />
                <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
                  {m.kind === "holdings" ? (
                    <>
                      <HoldingsText shown={m.shown} />
                      {m.card && (
                        <div className="chat-msg-in">
                          <HoldingsCard />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <ActionText shown={m.shown} />
                      {m.card && (
                        <div className="chat-msg-in">
                          <ActionCard awaiting={awaiting} result={result} pressed={pressApprove} approveRef={approveRef} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ),
          )}
          {loading && <LoadingDots />}
        </div>

        {/* virtual cursor lives over the whole card area */}
        {cursor.visible && <VirtualCursor x={cursor.x} y={cursor.y} pressed={cursor.pressed} />}
      </div>

      {/* composer + disclaimer */}
      <div style={{ flexShrink: 0, marginTop: 16, width: "100%", maxWidth: 560, marginInline: "auto" }}>
        <div style={{ position: "relative" }}>
          {/* nudge: sits directly above the send button while idle */}
          <div
            style={{
              position: "absolute",
              right: 2,
              bottom: "calc(100% + 12px)",
              opacity: started ? 0 : 1,
              transition: "opacity 0.35s ease",
              pointerEvents: "none",
            }}
          >
            <span
              className="nudge-bob"
              style={{
                display: "inline-block",
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 600,
                color: BLUE,
                whiteSpace: "nowrap",
                background: "#EAF4FC",
                border: `1px solid ${EDGE}`,
                borderRadius: 999,
                padding: "5px 12px",
                boxShadow: "0 4px 12px rgba(21,145,220,0.18)",
              }}
            >
              Tap send to watch Tends work
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 999, border: `1px solid ${EDGE}`, background: "#F7F9FC", padding: "9px 9px 9px 20px" }}>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left", fontFamily: SANS, fontSize: "0.98rem", color: typing ? NAVY : FAINT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {typing ? (
                <>
                  {typing}
                  <span className="caret-blink" />
                </>
              ) : (
                "Ask anything, or type / for commands"
              )}
            </span>
            <button
              ref={sendBtnRef}
              type="button"
              onClick={handleStart}
              disabled={started}
              aria-label="Send"
              className={started ? undefined : "send-glow send-btn"}
              style={{ width: 38, height: 38, flexShrink: 0, borderRadius: "50%", background: BLUE, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: started ? "default" : "pointer", padding: 0 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* the warning stays put below the composer */}
          <p
            style={{
              fontFamily: SANS,
              fontSize: 11,
              color: FAINT,
              textAlign: "center",
              margin: "12px 0 0",
            }}
          >
            Tends Agent can make mistakes. Review actions before you confirm.
          </p>
        </div>
      </div>
    </div>
  );
}
