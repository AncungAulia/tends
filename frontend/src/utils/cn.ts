// Lightweight className combiner — joins truthy class values with a space.
// Avoids the clsx + tailwind-merge dependency; sufficient for our usage.
type ClassValue = string | number | false | null | undefined;

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
