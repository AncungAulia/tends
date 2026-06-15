"use client";

import { useEffect, useState } from "react";
import { DEFAULT_DESIGN, isValidDesign } from "@/lib/cardDesigns";

const KEY = "tends.cardDesign";

/**
 * Persisted vault-card design preference (cosmetic). Stored in localStorage for
 * now — swap to a backend user-preference field later without touching callers.
 */
export function useCardDesign() {
  const [design, setDesign] = useState<string>(DEFAULT_DESIGN);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (isValidDesign(saved)) setDesign(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const update = (id: string) => {
    setDesign(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };

  return { design, setDesign: update };
}
