import type { Risk, Choice } from "./types";

export const GOAL: Choice[] = [
  { value: "safe",   label: "Keep it safe",                desc: "Grow slowly, don't lose it." },
  { value: "steady", label: "Grow it steadily",            desc: "Steady growth, not too bumpy." },
  { value: "max",    label: "Grow it as much as I can",    desc: "Bigger ups and downs are okay." },
];

export const DIPS: Choice[] = [
  { value: "out",  label: "Take it out",     desc: "I don't like losing money." },
  { value: "wait", label: "Leave it and wait", desc: "Ups and downs are normal." },
  { value: "add",  label: "Put in more",     desc: "A lower price is a good time to buy." },
];

export const RISK_FROM_GOAL: Record<string, Risk> = {
  safe: "Low",
  steady: "Medium",
  max: "High",
};

export const STOPLOSS: Record<string, number> = { out: 5, wait: 10, add: 20 };

export const RISK_MIX: Record<Risk, { sym: string; pct: number }[]> = {
  Low: [
    { sym: "mUSD", pct: 90 },
    { sym: "USDY", pct: 10 },
  ],
  Medium: [
    { sym: "mUSD", pct: 40 },
    { sym: "mETH", pct: 30 },
    { sym: "cmETH", pct: 30 },
  ],
  High: [
    { sym: "cmETH", pct: 40 },
    { sym: "sUSDe", pct: 30 },
    { sym: "mETH",  pct: 20 },
    { sym: "WMNT",  pct: 10 },
  ],
};

export const RISK_DESC: Record<Risk, string> = {
  Low:    "Protects first, grows slowly.",
  Medium: "Balanced growth, without the full market swing.",
  High:   "Chases the most upside, rides the swings.",
};

export const RISK_BADGE: Record<Risk, string> = {
  Low:    "bg-[#EAF4FC] text-[#1591DC]",
  Medium: "bg-yellow-50 text-yellow-700",
  High:   "bg-red-50 text-red-600",
};
