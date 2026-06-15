"use client";

import { Check } from "lucide-react";
import { CARD_DESIGNS, frontSrc } from "@/lib/cardDesigns";
import { cn } from "@/utils/cn";

/** Grid of vault-card skins (cosmetic). Lives inside the card-design overlay. */
export function CardDesignPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {CARD_DESIGNS.map((d) => {
        const active = d.id === value;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            aria-label={d.label}
            aria-pressed={active}
            className="group text-left focus:outline-none"
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-lg ring-2 transition-all",
                active
                  ? "ring-brand"
                  : "ring-transparent group-hover:ring-edge2 group-focus-visible:ring-brand/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frontSrc(d.id)}
                alt={d.label}
                draggable={false}
                className="aspect-[1.425/1] w-full select-none object-cover"
              />
              {active && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white shadow">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                active ? "text-brand" : "text-dim",
              )}
            >
              {d.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
