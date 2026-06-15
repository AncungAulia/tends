import { ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "destructive";

const BASE =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl " +
  "px-6 py-3 font-mono text-xs uppercase tracking-[0.04em] " +
  "transition-colors duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1591DC] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[#F7F9FC] dark:focus-visible:ring-offset-[#0C1A2B] " +
  "disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none";

const VARIANTS: Record<Variant, string> = {
  // Navy in light (wipe to white), inverts in dark.
  primary:
    "bg-[#0C1A2B] text-white hover:text-white sm:hover:text-[#0C1A2B] " +
    "dark:bg-white dark:text-[#0C1A2B] dark:sm:hover:text-white",
  secondary:
    "border border-[#DDE8F2] text-[#5B7490] hover:border-[#0C1A2B] hover:text-[#0C1A2B] " +
    "dark:border-white/10 dark:text-white/45 dark:hover:border-white/30 dark:hover:text-white",
  destructive:
    "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 " +
    "dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  /** Diagonal "conveyor" arrow on hover — reserve for the hero CTA per screen. */
  icon?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  icon = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <button
      disabled={disabled || loading}
      className={cn(BASE, VARIANTS[variant], className)}
      {...props}
    >
      {/* Wipe layer (primary only) — white panel rises on hover; desktop only */}
      {isPrimary && (
        <span
          aria-hidden="true"
          className="absolute inset-0 hidden translate-y-full bg-white transition-transform duration-[550ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 motion-reduce:hidden sm:block dark:bg-[#0C1A2B]"
        />
      )}

      <span className="relative z-10 flex items-center gap-2">
        {loading && <Spinner size="sm" className="text-current" />}
        <span>{loading && loadingLabel ? loadingLabel : children}</span>

        {icon && isPrimary && !loading && (
          <span className="relative inline-block h-3.5 w-3.5 overflow-hidden" aria-hidden="true">
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[160%] group-hover:-translate-y-[160%] motion-reduce:transition-none" />
            <ArrowUpRight className="absolute inset-0 h-3.5 w-3.5 -translate-x-[160%] translate-y-[160%] transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:translate-y-0 motion-reduce:translate-x-0 motion-reduce:translate-y-0" />
          </span>
        )}
      </span>
    </button>
  );
}
