import { cn } from "@/utils/cn";

const BASE =
  "inline-flex items-center rounded-full px-3 py-1 font-sans text-xs font-medium";

// Risk level badges. CUSTOM uses a neutral muted style (no purple).
export const RISK_BADGE: Record<string, string> = {
  LOW: "bg-[#EAF4FC] text-[#2C5EAD] border border-[#2C5EAD]/20",
  MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  HIGH: "bg-red-50 text-red-600 border border-red-200",
  CUSTOM: "bg-[#F7F9FC] text-[#5B7490] border border-[#DDE8F2] dark:bg-white/5 dark:text-white/50 dark:border-white/10",
};

export const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  paused: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  pending: "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/10",
};

interface BadgeProps {
  className?: string;
  children: React.ReactNode;
}

export function Badge({ className, children }: BadgeProps) {
  return <span className={cn(BASE, className)}>{children}</span>;
}
