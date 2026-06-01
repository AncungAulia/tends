"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { PageHeader } from "@/components/elements/PageHeader";
import { Card } from "@/components/elements/Card";
import { Skeleton } from "@/components/elements/Skeleton";
import { useActivity } from "@/hooks/useActivityLog";
import { relativeTime } from "@/utils/format";
import { cn } from "@/utils/cn";

type View = "table" | "timeline";
const STORAGE_KEY = "tends_activity_view";

// Title-case an action enum: REBALANCE → "Rebalance", PRICE_UPDATE → "Price Update".
function fmtAction(action: string): string {
  return action
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const ACTION_DOT: Record<string, string> = {
  REBALANCE: "bg-[#1591DC]",
  DEPOSIT: "bg-[#16A34A]",
  WITHDRAW: "bg-[#D97706]",
  PAUSE: "bg-[#DC2626]",
  ALERT: "bg-[#DC2626]",
};
const dotColor = (action: string) => ACTION_DOT[action.toUpperCase()] ?? "bg-[#5B7490]";

// Human-readable detail from metadata; "" when there's nothing to show.
function detail(metadata: unknown): string {
  if (metadata == null) return "";
  if (typeof metadata === "string") return metadata;
  if (typeof metadata === "object") {
    const entries = Object.entries(metadata as Record<string, unknown>);
    if (entries.length === 0) return "";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  }
  return String(metadata);
}

export function Activity() {
  const { activities, isLoading } = useActivity();
  const [view, setView] = useState<View>("table");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as View | null;
    if (saved) setView(saved);
  }, []);

  const setAndSave = (v: View) => {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  return (
    <>
      <PageHeader
        title="Activity"
        action={
          <div className="flex gap-1 rounded-lg border border-[#DDE8F2] p-0.5 dark:border-white/10">
            {[
              { v: "table" as const, icon: LayoutGrid },
              { v: "timeline" as const, icon: List },
            ].map(({ v, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setAndSave(v)}
                aria-label={`${v} view`}
                className={cn(
                  "rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC]/40",
                  view === v
                    ? "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15"
                    : "text-[#5B7490] dark:text-white/45",
                )}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        }
      />

      <Card className={view === "table" ? "p-0" : undefined}>
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-[#5B7490] dark:text-white/45">No activity yet.</p>
            <p className="text-xs text-[#5B7490]/60 dark:text-white/30">
              Tends Agent begins working after your first deposit.
            </p>
          </div>
        ) : view === "table" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#DDE8F2] text-left font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:border-white/8 dark:text-white/45">
                <th className="px-6 py-2.5 font-normal">Time</th>
                <th className="px-6 py-2.5 font-normal">Action</th>
                <th className="px-6 py-2.5 font-normal">Detail</th>
              </tr>
            </thead>
            <tbody className="text-[#0C1A2B] dark:text-white">
              {activities.map((a) => {
                const d = detail(a.metadata);
                return (
                  <tr key={a.id} className="border-b border-[#DDE8F2]/60 last:border-0 dark:border-white/5">
                    <td className="px-6 py-3.5 font-mono text-xs text-[#5B7490] dark:text-white/45">
                      {relativeTime(a.timestamp)}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor(a.action))} />
                        {fmtAction(a.action)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-[#5B7490] dark:text-white/45">
                      {d || <span className="text-[#5B7490]/50">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <ol className="relative space-y-6 border-l border-[#DDE8F2] pl-6 dark:border-white/10">
            {activities.map((a) => {
              const d = detail(a.metadata);
              return (
                <li key={a.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[1.78rem] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-[#0F2035]",
                      dotColor(a.action),
                    )}
                  />
                  <p className="font-mono text-xs text-[#5B7490] dark:text-white/45">
                    {relativeTime(a.timestamp)}
                  </p>
                  <p className="text-sm font-medium text-[#0C1A2B] dark:text-white">
                    {fmtAction(a.action)}
                  </p>
                  {d && (
                    <p className="mt-0.5 font-mono text-xs text-[#5B7490] dark:text-white/45">{d}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </>
  );
}
