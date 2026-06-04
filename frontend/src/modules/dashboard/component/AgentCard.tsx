"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { useAccount } from "wagmi";
import { useActivity } from "@/hooks/useActivityLog";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useUserVault } from "@/hooks/useUserVault";
import { useRiskLevel } from "@/hooks/useRiskLevel";

const BENTO_ITEM: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const ACT_TAG: Record<string, string> = {
  Rebalance: "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15 dark:text-[#4BB8FA]",
  Deposit:   "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  Withdraw:  "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  Monitor:   "bg-[#EDF2F7] text-[#5B7490] dark:bg-white/10 dark:text-white/45",
};

function actionType(action: string): string {
  switch (action.toUpperCase()) {
    case "REBALANCE": return "Rebalance";
    case "DEPOSIT":   return "Deposit";
    case "WITHDRAW":  return "Withdraw";
    default:          return "Monitor";
  }
}

function timeLabel(ts: Date): string {
  const now = Date.now();
  const diff = now - ts.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return ts.toLocaleDateString();
}

const RISK_LABELS: Record<number, string> = { 0: "Low", 1: "Medium", 2: "High", 3: "Custom" };

const AGENT_STATES = {
  idle:    { label: "Idle",    dot: "bg-[#1591DC]" },
  running: { label: "Running", dot: "bg-[#8CC8EE]" },
  paused:  { label: "Paused",  dot: "bg-[#B4C0CE]" },
} as const;

export function AgentCard() {
  const { address } = useAccount();
  const { vaultAddress } = useUserVault();
  const { paused } = usePortfolio(vaultAddress, address);
  const { currentLevel } = useRiskLevel(vaultAddress);
  const { activities } = useActivity(3);

  const riskName = RISK_LABELS[currentLevel ?? 1] ?? "Medium";

  const lastActivity = activities[0];
  const lastAgo = lastActivity ? Date.now() - lastActivity.timestamp.getTime() : Infinity;
  const stateKey: keyof typeof AGENT_STATES = paused
    ? "paused"
    : lastAgo < 5 * 60 * 1000
      ? "running"
      : "idle";
  const state = AGENT_STATES[stateKey];

  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (stateKey !== "running") return;
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 450);
    return () => clearInterval(id);
  }, [stateKey]);

  return (
    <motion.div
      variants={BENTO_ITEM}
      className="flex flex-col rounded-2xl border-[1.25px] border-[#E8EAEC] bg-white p-5 dark:border-white/8 dark:bg-[#0F2035]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B7490] dark:text-white/45">
            Your Agent
          </p>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${state.dot}`} />
            <span className="text-[11px] font-medium text-[#5B7490] dark:text-white/45">
              {state.label}{stateKey === "running" ? dots : ""}
            </span>
          </span>
        </div>
        <Link
          href="/agent"
          aria-label="Open agent"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E8EAEC] text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B] dark:border-white/10 dark:text-white/45 dark:hover:border-white/20 dark:hover:text-white"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3 dark:bg-white/5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#94A3B8] dark:text-white/30">Risk</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B] dark:text-white">{riskName}</p>
        </div>
        <div className="flex-1 rounded-xl bg-[#F7F9FC] px-4 py-3 dark:bg-white/5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#94A3B8] dark:text-white/30">Next run</p>
          <p className="mt-0.5 text-sm font-semibold text-[#0C1A2B] dark:text-white">
            {paused ? "Paused" : "~4h"}
          </p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1 py-4 text-center">
          <p className="text-xs text-[#5B7490] dark:text-white/45">No activity yet.</p>
        </div>
      ) : (
        <div className="mt-2">
          {activities.map((a, i) => {
            const type = actionType(a.action);
            const tagCls = ACT_TAG[type] ?? ACT_TAG.Monitor;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 py-2.5 ${i < activities.length - 1 ? "border-b border-[#E8EAEC] dark:border-white/8" : ""}`}
              >
                <span className={`w-20 shrink-0 rounded-md px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wider ${tagCls}`}>
                  {type}
                </span>
                <span className="flex-1 truncate text-[13px] text-[#0C1A2B] dark:text-white">
                  {a.action === "REBALANCE" ? "Rebalanced portfolio" : a.action.charAt(0) + a.action.slice(1).toLowerCase()}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#94A3B8] dark:text-white/30">
                  {timeLabel(a.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
