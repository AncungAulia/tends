import { ArrowRight } from "lucide-react";

export function NextButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1591DC] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      Continue <ArrowRight className="h-4 w-4" />
    </button>
  );
}
