// Pure formatting helpers — no contract coupling.

/** 0x1234...5678 — first 6, last 4 characters. */
export function shortAddress(addr?: string | null): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** USD figure with 2 decimals and thousands separators. */
export function formatUSD(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** USDC amount — plain number, 2 decimals, thousands separators. */
export function formatUSDC(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Token balance — decimals scale with magnitude. */
export function formatBalance(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const decimals = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Percentage with 1 decimal place, e.g. 32.5%. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value.toFixed(1)}%`;
}

/** Basis points → percentage number. 3000 bps → 30. */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** Percentage number → basis points. 30 → 3000. */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/** Relative time label, e.g. "2h ago", "3d ago", "just now". */
export function relativeTime(date: Date | null | undefined): string {
  if (!date) return "--";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Action enum → title case. REBALANCE → "Rebalance", PRICE_UPDATE → "Price Update". */
export function formatAction(action: string): string {
  return action
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Risk level enum → label. */
export const RISK_LABELS: Record<number, string> = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
  3: "CUSTOM",
};
