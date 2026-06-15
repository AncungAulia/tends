"use client";

import { useState, useEffect } from "react";
import { Search, ChevronRight, X, Repeat, ArrowDownLeft, ArrowUpRight, Eye, type LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Drawer as Vaul } from "vaul";
import { useActivity, type ActivityEntry } from "@/hooks/useActivityLog";
import { useUserVault } from "@/hooks/useUserVault";

/* ──────────────────────────────────────────────────────────
   Activity module — Tends
   Filters · grouped history · detail drawer (desktop) / sheet (mobile)
   ────────────────────────────────────────────────────────── */

// ─── Types ──────────────────────────────────────────────────

type ActType = "Rebalance" | "Deposit" | "Withdraw" | "Monitor";

const TAG: Record<ActType, string> = {
  Rebalance: "bg-brand-soft text-brand",
  Deposit:   "bg-pos-soft text-pos",
  Withdraw:  "bg-neg-soft text-neg",
  Monitor:   "bg-panel text-dim",
};

const ACT_ICON: Record<ActType, LucideIcon> = {
  Rebalance: Repeat,
  Deposit:   ArrowDownLeft,
  Withdraw:  ArrowUpRight,
  Monitor:   Eye,
};

const STEP_DOT: Record<string, string> = {
  SCAN:    "#C5D0DC",
  SIGNAL:  "#2C5EAD",
  ANALYZE: "#1591DC",
  DECIDE:  "#1591DC",
  EXEC:    "#1591DC",
  DONE:    "#16A34A",
};

const STEP_TAG: Record<string, string> = {
  SCAN:    "bg-panel text-dim",
  SIGNAL:  "bg-brand-soft text-brand",
  ANALYZE: "bg-brand-soft text-brand",
  DECIDE:  "bg-brand-soft text-brand",
  EXEC:    "bg-brand-soft text-brand",
  DONE:    "bg-pos-soft text-pos",
};

function toActType(action: string): ActType {
  switch (action.toUpperCase()) {
    case "REBALANCE": return "Rebalance";
    case "DEPOSIT":   return "Deposit";
    case "WITHDRAW":  return "Withdraw";
    default:          return "Monitor";
  }
}

function impactTone(t: ActType): "pos" | "neg" | "neutral" {
  if (t === "Deposit") return "pos";
  if (t === "Withdraw") return "neg";
  return "neutral";
}

function buildDesc(action: string, meta: unknown): string {
  const m = (meta && typeof meta === "object") ? meta as Record<string, unknown> : {};
  switch (action.toUpperCase()) {
    case "REBALANCE":
      if (m.swaps != null) {
        const n = Number(m.swaps);
        return `Rebalanced portfolio — ${n} swap${n !== 1 ? "s" : ""}`;
      }
      return "Rebalanced portfolio";
    case "DEPOSIT":
      if (m.amount != null) return `Deposited $${Number(m.amount).toLocaleString("en-US")} USDC`;
      return "Deposited to vault";
    case "WITHDRAW":
      if (m.amount != null) return `Withdrew $${Number(m.amount).toLocaleString("en-US")} USDC`;
      return "Withdrew from vault";
    case "PAUSE":  return "Agent paused";
    case "RESUME": return "Agent resumed";
    case "ALERT":  return String(m.message ?? "Agent alert");
    default:
      return action.charAt(0) + action.slice(1).toLowerCase() + " event";
  }
}

function impactText(entry: ActivityEntry, t: ActType): string {
  const m = (entry.metadata && typeof entry.metadata === "object")
    ? entry.metadata as Record<string, unknown> : {};
  if (m.impact) return String(m.impact);
  if (m.amount != null) {
    const prefix = t === "Withdraw" ? "-$" : "+$";
    return `${prefix}${Number(m.amount).toLocaleString("en-US")}`;
  }
  if (t === "Rebalance" && m.swaps != null) {
    const n = Number(m.swaps);
    return `${n} swap${n !== 1 ? "s" : ""}`;
  }
  return "—";
}

function dayLabel(ts: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (ts.toDateString() === today.toDateString()) return "Today";
  if (ts.toDateString() === yesterday.toDateString()) return "Yesterday";
  return ts.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeStr(ts: Date): string {
  return ts.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Display model ──────────────────────────────────────────

type DisplayAct = {
  id: string;
  day: string;
  time: string;
  type: ActType;
  desc: string;
  impact: string;
  impactTone: "pos" | "neg" | "neutral";
  metadata: unknown;
  txHash?: string;
};

// ─── Detail body (shared between drawer and sheet) ───────────

function humanMeta(action: string, meta: unknown): { label: string; value: string }[] {
  const m = (meta && typeof meta === "object") ? meta as Record<string, unknown> : {};
  const rows: { label: string; value: string }[] = [];
  if (m.swaps != null)     rows.push({ label: "Swaps executed", value: String(m.swaps) });
  if (m.amount != null)    rows.push({ label: "Amount", value: `$${Number(m.amount).toLocaleString("en-US")} USDC` });
  if (m.reasoning != null) rows.push({ label: "Reasoning", value: String(m.reasoning) });
  if (m.message != null)   rows.push({ label: "Message", value: String(m.message) });
  if (!rows.length && action === "REBALANCE") rows.push({ label: "Note", value: "On-chain rebalance event" });
  return rows;
}

function ActBody({ act }: { act: DisplayAct }) {
  const metaRows = humanMeta(act.type.toUpperCase(), act.metadata);
  // If we have specific metadata, render it as a clean step-like list
  if (metaRows.length > 0) {
    return (
      <>
        <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-widest text-faint">
          Details
        </p>
        <div className="space-y-4">
          {metaRows.map((r, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STEP_DOT["DONE"] }}
                />
              </div>
              <div className="flex-1">
                <span className={`inline-block rounded-md px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider ${STEP_TAG["DONE"]}`}>
                  {r.label}
                </span>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.value}</p>
              </div>
            </div>
          ))}
          {act.txHash && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STEP_DOT["EXEC"] }} />
              </div>
              <div className="flex-1">
                <span className={`inline-block rounded-md px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wider ${STEP_TAG["EXEC"]}`}>
                  Transaction
                </span>
                <a
                  href={`https://explorer.sepolia.mantle.xyz/tx/${act.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 block truncate font-mono text-xs text-brand hover:underline"
                >
                  {act.txHash}
                </a>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
  // Fallback: just show type + tx
  return (
    <>
      <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-widest text-faint">
        Details
      </p>
      <p className="text-sm leading-relaxed text-dim">
        {act.type} recorded on-chain.
        {act.txHash && (
          <>
            {" "}
            <a
              href={`https://explorer.sepolia.mantle.xyz/tx/${act.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-brand hover:underline"
            >
              View tx
            </a>
          </>
        )}
      </p>
    </>
  );
}

// ─── Responsive layout hook ──────────────────────────────────

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

// ─── Row ────────────────────────────────────────────────────

function Row({ a, onClick }: { a: DisplayAct; onClick: () => void }) {
  const impactColor =
    a.impactTone === "pos" ? "text-pos"
    : a.impactTone === "neg" ? "text-neg"
    : "text-faint";
  const Icon = ACT_ICON[a.type];
  return (
    <>
      {/* desktop: compact table row */}
      <button
        onClick={onClick}
        className="hidden w-full items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-panel md:flex"
      >
        <span className="w-12 shrink-0 font-mono text-[0.6875rem] text-faint">{a.time}</span>
        <span className={`w-24 shrink-0 rounded-md px-2 py-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[a.type]}`}>
          {a.type}
        </span>
        <span className="flex-1 truncate text-sm text-ink">{a.desc}</span>
        <span className={`w-24 shrink-0 text-right text-xs font-medium ${impactColor}`}>{a.impact}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>

      {/* mobile: icon-led card row */}
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors active:bg-panel md:hidden"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TAG[a.type]}`}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-ink">{a.desc}</p>
            {a.impact !== "—" && (
              <span className={`shrink-0 text-xs font-semibold ${impactColor}`}>{a.impact}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-faint">{a.type}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-edge" />
            <span className="font-mono text-[0.625rem] text-faint">{a.time}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 self-center text-faint" />
      </button>
    </>
  );
}

// ─── Mobile detail sheet (Vaul) ──────────────────────────────

function MobileDetailSheet({ act, onClose }: { act: DisplayAct | null; onClose: () => void }) {
  const impactColor =
    act?.impactTone === "pos" ? "text-pos"
    : act?.impactTone === "neg" ? "text-neg"
    : "text-faint";
  return (
    <Vaul.Root open={!!act} onOpenChange={(o) => !o && onClose()}>
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-tip/40 backdrop-blur-[1px]" />
        <Vaul.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-edge bg-card outline-none"
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-edge" />
          {act && (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
                <div className="min-w-0">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[act.type]}`}>
                    {act.type}
                  </span>
                  <Vaul.Title className="mt-2 text-base font-semibold text-ink">{act.desc}</Vaul.Title>
                  <p className="mt-0.5 text-xs text-dim">{act.day} · {act.time}</p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${impactColor}`}>{act.impact}</span>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <ActBody act={act} />
              </div>
            </>
          )}
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}

// ─── Desktop drawer ──────────────────────────────────────────

function Drawer({ act, onClose }: { act: DisplayAct | null; onClose: () => void }) {
  const open = !!act;
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  const impactColor =
    act?.impactTone === "pos" ? "text-pos"
    : act?.impactTone === "neg" ? "text-neg"
    : "text-faint";
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-tip/40 backdrop-blur-[1px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        {act && (
          <>
            <div className="flex items-start justify-between border-b border-edge p-5">
              <div>
                <span className={`inline-block rounded-md px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider ${TAG[act.type]}`}>
                  {act.type}
                </span>
                <p className="mt-2 text-base font-semibold text-ink">{act.desc}</p>
                <p className="mt-0.5 text-xs text-dim">{act.day} · {act.time}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-[1.25px] border-edge text-dim transition-colors hover:border-ink hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className={`text-sm font-semibold ${impactColor}`}>{act.impact}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ActBody act={act} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const FILTERS = ["All", "Rebalance", "Deposit", "Withdraw", "Monitor"] as const;

export function Activity() {
  useUserVault();
  const { activities, isLoading } = useActivity(100);
  const isDesktop = useIsDesktop();

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DisplayAct | null>(null);
  const [shown, setShown] = useState(15);

  useEffect(() => { setShown(15); }, [filter, query]);

  const displayActivities: DisplayAct[] = activities.map((a) => {
    const t = toActType(a.action);
    return {
      id: a.id,
      day: dayLabel(a.timestamp),
      time: timeStr(a.timestamp),
      type: t,
      desc: buildDesc(a.action, a.metadata),
      impact: impactText(a, t),
      impactTone: impactTone(t),
      metadata: a.metadata,
      txHash: a.txHash,
    };
  });

  const filtered = displayActivities.filter(
    (a) =>
      (filter === "All" || a.type === filter) &&
      a.desc.toLowerCase().includes(query.toLowerCase()),
  );
  const visible = filtered.slice(0, shown);
  const days = [...new Set(visible.map((a) => a.day))];

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-2 md:px-8 md:py-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="hidden md:block">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">Activity</h1>
            <p className="mt-1 text-sm text-dim">Every move the agent and you have made.</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full border-[1.25px] px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-edge bg-card text-dim hover:text-ink"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border-[1.25px] border-edge bg-card px-3 py-1.5 focus-within:border-brand">
            <Search className="h-3.5 w-3.5 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activity"
              className="w-36 bg-transparent text-xs text-ink outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div className="rounded-2xl border-[1.25px] border-edge bg-card p-2">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-full tends-skeleton rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-faint">
              {activities.length === 0 ? "No activity yet." : "No activity matches your filter."}
            </p>
          ) : (
            days.map((day) => (
              <motion.div
                key={day}
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.05 } } }}
              >
                <p className="px-3 pb-1 pt-3 text-[0.625rem] font-semibold uppercase tracking-widest text-faint">
                  {day}
                </p>
                {visible
                  .filter((a) => a.day === day)
                  .map((a) => (
                    <motion.div
                      key={a.id}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                      }}
                    >
                      <Row a={a} onClick={() => setSelected(a)} />
                    </motion.div>
                  ))}
              </motion.div>
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex justify-center">
            {shown < filtered.length ? (
              <button
                onClick={() => setShown((s) => s + 15)}
                className="rounded-full border-[1.25px] border-edge bg-card px-5 py-2 text-xs font-medium text-dim transition-colors hover:border-dim hover:text-ink"
              >
                Load more
              </button>
            ) : (
              <p className="text-[0.6875rem] text-faint">You&apos;re all caught up</p>
            )}
          </div>
        )}

        <div className="h-12" />
      </div>

      {isDesktop ? (
        <Drawer act={selected} onClose={() => setSelected(null)} />
      ) : (
        <MobileDetailSheet act={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
