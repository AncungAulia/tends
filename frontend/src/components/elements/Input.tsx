import { cn } from "@/utils/cn";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[#DDE8F2] bg-white px-4 py-2.5 text-sm font-sans",
        "placeholder:text-[#5B7490] focus:outline-none focus:ring-2 focus:ring-[#1591DC]/20 focus:border-[#1591DC]",
        "dark:bg-[#0F2035] dark:border-white/10 dark:text-white dark:placeholder:text-white/30",
        className,
      )}
      {...props}
    />
  );
}
