import { cn } from "@/utils/cn";

type SpinnerSize = "sm" | "md" | "lg";

// Ring spinner — colored top/bottom arc, transparent sides, rotating.
// Colored part uses currentColor, so pass a text-* class to recolor
// (e.g. text-white inside a dark button). Default is brand blue.
const SIZE: Record<SpinnerSize, string> = {
  sm: "w-3.5 h-3.5 border-2",
  md: "w-5 h-5 border-2",
  lg: "w-8 h-8 border-[3px]",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-[tends-spin_0.8s_linear_infinite] rounded-full",
        "border-y-current border-x-transparent text-[#1591DC] dark:text-[#4BB8FA]",
        SIZE[size],
        className,
      )}
    />
  );
}
