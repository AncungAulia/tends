import { Check } from "lucide-react";
import { StepHead } from "./StepHead";
import type { Choice } from "./types";

interface Props {
  title: string;
  sub?: string;
  options: Choice[];
  selected?: string;
  onPick: (v: string) => void;
}

export function ChoiceStep({ title, sub, options, selected, onPick }: Props) {
  return (
    <div>
      <StepHead title={title} sub={sub} />
      <div className="flex flex-col gap-2.5">
        {options.map((opt) => {
          const on = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onPick(opt.value)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border-[1.25px] p-4 text-left transition-colors ${
                on
                  ? "border-[#1591DC] bg-[#EAF4FC]"
                  : "border-[#E8EAEC] bg-white hover:border-[#CBD5E1]"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-[#0C1A2B]">{opt.label}</span>
                <span className="block text-xs text-[#5B7490]">{opt.desc}</span>
              </span>
              {on && <Check className="h-4 w-4 shrink-0 text-[#1591DC]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
