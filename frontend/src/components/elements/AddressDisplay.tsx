"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { shortAddress } from "@/utils/format";
import { cn } from "@/utils/cn";

interface AddressDisplayProps {
  address?: string | null;
  className?: string;
}

export function AddressDisplay({ address, className }: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!address) return null;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono text-xs text-[#5B7490] dark:text-white/45">
        {shortAddress(address)}
      </span>
      <button
        onClick={copy}
        aria-label="Copy address"
        className="text-[#5B7490] transition-colors hover:text-[#1591DC] dark:text-white/40 dark:hover:text-[#4BB8FA]"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}
