import { AlertTriangle } from "lucide-react";

export function PausedBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-300/60 bg-yellow-50 px-4 py-3 dark:border-yellow-500/30 dark:bg-yellow-950/30">
      <AlertTriangle size={18} className="shrink-0 text-yellow-600 dark:text-yellow-400" />
      <p className="text-sm text-yellow-700 dark:text-yellow-400">
        Vault is paused by the agent. Deposits are temporarily unavailable.
        Withdrawals remain open.
      </p>
    </div>
  );
}
