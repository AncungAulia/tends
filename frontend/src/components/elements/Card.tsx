import { cn } from "@/utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#DDE8F2] bg-white p-6",
        "dark:border-white/8 dark:bg-[#0F2035]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
