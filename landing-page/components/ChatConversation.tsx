"use client";

import { useState } from "react";
import TendsBotFace from "./TendsBotFace";
import ConfirmFace from "./ConfirmFace";

/* A mock conversation in the friend's FE bubble layout, but with OUR pieces:
   the agent avatar is the medium bot face, and the action card is driven by
   ConfirmFace (ask -> approve = check eyes / deny = X eyes). Navy user bubbles
   on the right, avatar + plain agent text on the left, plus a holdings card.
   No em-dashes in copy. */

const NAVY = "#0C1A2B";
const BLUE = "#1591DC";
const MUTED = "#5B7490";
const EDGE = "#DDE8F2";
const SANS = "var(--font-sans)";

// Agent avatar: our medium bot face (static), on a pale chip.
function Avatar() {
  return (
    <div
      style={{
        marginTop: 2,
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: "50%",
        background: "#EAF4FC",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: 3,
      }}
    >
      <TendsBotFace variant="medium" active={false} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "80%",
          background: NAVY,
          color: "#fff",
          fontFamily: SANS,
          fontSize: 14,
          lineHeight: 1.45,
          borderRadius: 16,
          borderBottomRightRadius: 5,
          padding: "10px 16px",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AgentRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Avatar />
      <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>{children}</div>
    </div>
  );
}

function AgentText({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.55, color: NAVY, margin: 0 }}>{children}</p>;
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

// Our confirm flow: the ConfirmFace reacts; you approve or decline.
function ActionCard() {
  const [state, setState] = useState<"asking" | "approved" | "denied">("asking");
  const ok = state === "approved";
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

      {state === "asking" ? (
        <div style={{ display: "flex", borderTop: "1px solid #F0F4F8" }}>
          <button
            onClick={() => setState("denied")}
            style={{ flex: 1, padding: "10px 0", fontFamily: SANS, fontSize: 12, fontWeight: 500, color: MUTED, background: "transparent", border: "none", cursor: "pointer" }}
          >
            Decline
          </button>
          <div style={{ width: 1, background: "#F0F4F8" }} />
          <button
            onClick={() => setState("approved")}
            style={{ flex: 1, padding: "10px 0", fontFamily: SANS, fontSize: 12, fontWeight: 600, color: BLUE, background: "transparent", border: "none", cursor: "pointer" }}
          >
            Confirm
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
            padding: "10px 0",
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 500,
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
          {ok ? "Approved" : "Declined"}
        </div>
      )}
    </div>
  );
}

export default function ChatConversation() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <UserBubble text="How's my money doing?" />
      <AgentRow>
        <AgentText>
          You&apos;re up <span style={{ color: "#15803d", fontWeight: 600 }}>+2.31%</span> all time. Here&apos;s the breakdown:
        </AgentText>
        <HoldingsCard />
      </AgentRow>

      <UserBubble text="Move 30% of cmETH into sUSDe" />
      <AgentRow>
        <AgentText>Here&apos;s what I&apos;d do. Approve it or decline.</AgentText>
        <ActionCard />
      </AgentRow>
    </div>
  );
}
