import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { prisma } from "../db/client.js";

export type LogStatus = "running" | "done" | "skip" | "error";

export interface AgentLogEntry {
  /** Unique ID for deduplication / ordering. */
  id: string;
  ts: string;
  vaultAddress: string;
  /** Workflow ID (e.g. "hermes-rebalancer", "enforce-guardrails", "deterministic"). */
  workflow: string;
  /** Step within the workflow (e.g. "scan-vault", "signal-market", "exec-rebalance"). */
  step: string;
  status: LogStatus;
  /** Human-readable summary shown in the frontend activity feed. */
  message: string;
  /** Optional structured data (reasoning, allocation, tx hash, errors). */
  data?: Record<string, unknown>;
}

class AgentLogEmitter extends EventEmitter {
  /** Emit a typed log entry.  Idempotent — always assigns a fresh id + timestamp. */
  log(entry: Omit<AgentLogEntry, "id" | "ts">): void {
    const full: AgentLogEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      ...entry,
    };
    this.emit("entry", full);

    // Persist final-status entries to DB for historical display.
    // "running" events are SSE-only (intermediate state, not worth storing).
    if (full.status !== "running") {
      prisma.agentLog.create({
        data: {
          id: full.id,
          vaultAddress: full.vaultAddress,
          workflow: full.workflow,
          step: full.step,
          status: full.status,
          message: full.message,
          data: full.data ? (full.data as object) : undefined,
          ts: new Date(full.ts),
        },
      }).catch(() => {});
    }
  }
}

/**
 * Process-wide agent log bus.
 * Rebalancer workflow steps and the deterministic rebalancer write here;
 * the SSE endpoint reads from here and fans out to connected clients.
 *
 * maxListeners raised to 200 so many simultaneous SSE connections don't
 * trigger Node's "possible memory leak" warning.
 */
export const agentLogEmitter = new AgentLogEmitter();
agentLogEmitter.setMaxListeners(200);
