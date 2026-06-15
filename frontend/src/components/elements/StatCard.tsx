import { Card } from "./Card";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  delta?: number | null;
  accent?: "default" | "warning";
  /** Badge/short-text values: drops the big-number sizing so label, value, and
   *  meta sit at an even vertical rhythm. */
  compact?: boolean;
}

export function StatCard({
  label,
  value,
  meta,
  delta,
  accent = "default",
  compact = false,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col justify-center gap-2.5 p-7",
        accent === "warning" && "border-yellow-300/60 dark:border-yellow-500/30",
      )}
    >
      <p className="text-sm font-medium text-[#5B7490] dark:text-white/45">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono tracking-tight tabular-nums text-[#0C1A2B] dark:text-white",
            compact
              ? "text-base font-semibold leading-tight"
              : "text-2xl font-semibold leading-none sm:text-3xl",
          )}
        >
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              "font-mono text-sm",
              delta >= 0 ? "text-[#16A34A]" : "text-[#DC2626]",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
      {meta && (
        <p className="text-xs text-[#5B7490] dark:text-white/45">{meta}</p>
      )}
    </Card>
  );
}
