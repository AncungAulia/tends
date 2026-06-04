"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Plus, Check } from "lucide-react";

/**
 * Bare exclusion picker: red chips of selected values + an "Add" popover.
 * No outer card — the caller decides the surrounding container.
 */
export default function ExclusionField({
  title,
  desc,
  selected,
  onChange,
  options,
  searchable = false,
  searchHint = "Search",
  renderIcon,
}: {
  title?: string;
  desc?: string;
  selected: string[];
  onChange: (next: string[]) => void;
  options: { value: string; cat?: string }[];
  searchable?: boolean;
  searchHint?: string;
  renderIcon: (value: string, cat?: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const optCat = new Map(options.map((o) => [o.value, o.cat]));
  const filtered = options.filter(
    (o) => !searchable || o.value.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      {title && <p className="text-sm font-medium text-[#0C1A2B]">{title}</p>}
      {desc && <p className="text-xs text-[#5B7490]">{desc}</p>}
      <div className={`flex flex-wrap items-center gap-1.5 ${title || desc ? "mt-3" : ""}`}>
        {selected.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1.5 rounded-md bg-red-50 py-1 pl-1.5 pr-2 text-xs font-medium text-red-600"
          >
            {renderIcon(v, optCat.get(v))}
            {v}
            <X
              className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
              onClick={() => toggle(v)}
            />
          </span>
        ))}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-md border border-dashed border-[#E8EAEC] px-2 py-1 text-xs text-[#5B7490] transition-colors hover:border-[#5B7490] hover:text-[#0C1A2B]"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{ transformOrigin: "top left" }}
                className="absolute left-0 top-[calc(100%+6px)] z-30 w-60 overflow-hidden rounded-xl border border-[#E8EAEC] bg-white p-1 shadow-lg shadow-[#0C1A2B]/8"
              >
                {searchable && (
                  <div className="flex items-center gap-2 border-b border-[#F0F4F8] px-2.5 py-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                    <input
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={searchHint}
                      className="w-full bg-transparent text-xs text-[#0C1A2B] outline-none placeholder:text-[#94A3B8]"
                    />
                  </div>
                )}
                <div className="max-h-56 overflow-y-auto py-1">
                  {filtered.length === 0 && (
                    <p className="px-3 py-2 text-xs text-[#94A3B8]">No matches</p>
                  )}
                  {filtered.map((o) => {
                    const on = selected.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        onClick={() => toggle(o.value)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                          on ? "bg-[#EAF4FC] text-[#1591DC]" : "text-[#0C1A2B] hover:bg-[#F7F9FC]"
                        }`}
                      >
                        {renderIcon(o.value, o.cat)}
                        <span className="flex-1 truncate">{o.value}</span>
                        {on && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
