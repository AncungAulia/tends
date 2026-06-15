import { resolveTargetBps } from "./services/rebalance-math.js";
import { blendedApy, currentApy } from "./services/projection.js";
import { RISK_LEVEL, type RiskLevel } from "./chain/tokens.js";

export type StrategyId = "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";

export interface AllocationSlice {
  symbol: string;
  pct: number;
}

export interface StrategyMeta {
  id: StrategyId;
  riskLevel: RiskLevel;
  name: string;
  tag: string;
  apyLabel: string;
  allocation: string;
  allocationBreakdown: AllocationSlice[];
  risk: string;
  // Setup page card copy — BE owns these so FE doesn't drift via local fallback.
  volatilityPct: number | null;
  description: string;
  holdHint: string;
  worstDropHint: string;
  bestFor: string;
}

export const STRATEGIES: StrategyMeta[] = [
  {
    id: "LOW",
    riskLevel: RISK_LEVEL.LOW,
    name: "LOW",
    tag: "treasuries only",
    apyLabel: "~4-5%",
    allocation: "90% mUSD + 10% USDY",
    allocationBreakdown: [
      { symbol: "mUSD", pct: 90 },
      { symbol: "USDY", pct: 10 },
    ],
    risk: "Very Low",
    volatilityPct: 3,
    description: "Built to keep your capital steady.",
    holdHint: "No minimum",
    worstDropHint: "under 1%",
    bestFor: "Parking capital",
  },
  {
    id: "MEDIUM",
    riskLevel: RISK_LEVEL.MEDIUM,
    name: "MEDIUM",
    tag: "balanced basket",
    apyLabel: "~5-6%",
    allocation: "40% mUSD + 30% mETH + 30% cmETH",
    allocationBreakdown: [
      { symbol: "mUSD",  pct: 40 },
      { symbol: "mETH",  pct: 30 },
      { symbol: "cmETH", pct: 30 },
    ],
    risk: "Moderate",
    volatilityPct: 14,
    description: "Balanced growth, without the full market swing.",
    holdHint: "3+ months",
    worstDropHint: "around 5%",
    bestFor: "Steady growth",
    // blended ≈ 5.4% with default APYs
  },
  {
    id: "HIGH",
    riskLevel: RISK_LEVEL.HIGH,
    name: "HIGH",
    tag: "yield max",
    apyLabel: "~8-14%",
    // WMNT (wrapped MNT) is the actual on-chain token held — keep the canonical
    // symbol consistent with chain/tokens.ts so FE doesn't have to patch it.
    allocation: "40% cmETH + 30% sUSDe + 20% mETH + 10% WMNT",
    allocationBreakdown: [
      { symbol: "cmETH", pct: 40 },
      { symbol: "sUSDe", pct: 30 },
      { symbol: "mETH",  pct: 20 },
      { symbol: "WMNT",  pct: 10 },
    ],
    risk: "High",
    volatilityPct: 28,
    description: "Chases the most upside, rides the swings.",
    holdHint: "1+ year",
    worstDropHint: "around 12%",
    bestFor: "Long horizon",
  },
  {
    id: "CUSTOM",
    riskLevel: RISK_LEVEL.CUSTOM,
    name: "CUSTOM",
    tag: "mix it yourself",
    apyLabel: "computed",
    allocation: "Pick your own ratio",
    allocationBreakdown: [],
    risk: "Variable",
    volatilityPct: null,
    description: "Your own mix, held on target by the agent.",
    holdHint: "—",
    worstDropHint: "—",
    bestFor: "Fine control",
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface StrategyView extends StrategyMeta {
  /** Blended APY for the preset; null for CUSTOM (depends on the user's mix). */
  blendedApyPct: number | null;
}

/** Strategies enriched with a current blended APY (CUSTOM stays null). */
export function listStrategies(apy = currentApy()): StrategyView[] {
  return STRATEGIES.map((s) => ({
    ...s,
    blendedApyPct:
      s.riskLevel === RISK_LEVEL.CUSTOM
        ? null
        : round2(blendedApy(resolveTargetBps(s.riskLevel), apy)),
  }));
}

export function getStrategy(id: string, apy = currentApy()): StrategyView | null {
  return listStrategies(apy).find((s) => s.id === id) ?? null;
}

/** Map a strategy id string → on-chain RiskLevel, or null if unknown. */
export function riskLevelFromId(id: string): RiskLevel | null {
  return STRATEGIES.find((s) => s.id === id)?.riskLevel ?? null;
}
