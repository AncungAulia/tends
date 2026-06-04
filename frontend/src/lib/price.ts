// Some tokens (e.g. GOOGL) have not had a price pushed to the oracle yet.
// `getPriceUnsafe` returns (0n, 0n) for these — NOT a revert. Flag them as
// "unavailable" and never render a USD value of $0.00 for them.

export type PriceStatus = "available" | "unavailable" | "stale";

const MAX_STALENESS_SECONDS = 2 * 60 * 60; // 2 hours (matches the contract)

export interface PriceResult {
  priceUSD: number | null;
  updatedAt: Date | null;
  status: PriceStatus;
}

export function parsePriceResult(
  raw: readonly [bigint, bigint] | undefined,
): PriceResult {
  if (!raw || raw[0] === 0n) {
    return { priceUSD: null, updatedAt: null, status: "unavailable" };
  }

  const priceUSD = Number(raw[0]) / 1e18;
  const updatedAt = new Date(Number(raw[1]) * 1000);
  const elapsedSeconds = Date.now() / 1000 - Number(raw[1]);

  const status: PriceStatus =
    elapsedSeconds > MAX_STALENESS_SECONDS ? "stale" : "available";

  return { priceUSD, updatedAt, status };
}
