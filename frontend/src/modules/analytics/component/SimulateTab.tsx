"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/elements/Card";
import { Input } from "@/components/elements/Input";
import { formatUSD } from "@/utils/format";
import { cn } from "@/utils/cn";

type StrategyId = "LOW" | "MEDIUM" | "HIGH" | "CUSTOM";

const STRATEGIES: { id: StrategyId; label: string }[] = [
  { id: "LOW",    label: "Low" },
  { id: "MEDIUM", label: "Medium" },
  { id: "HIGH",   label: "High" },
  { id: "CUSTOM", label: "Custom" },
];

const RANGES = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const PRESET_ALLOCATIONS: Record<string, Record<string, number>> = {
  LOW:    { mUSD: 90, USDY: 10 },
  MEDIUM: { mUSD: 40, mETH: 30, cmETH: 30 },
  HIGH:   { cmETH: 40, sUSDe: 30, mETH: 20, MNT: 10 },
};

const ALL_ASSETS = ["mUSD", "USDY", "mETH", "cmETH", "sUSDe", "MNT"];

const FALLBACK_APY: Record<string, number> = {
  mUSD: 5.0, USDY: 5.0, mETH: 3.5, cmETH: 4.0, sUSDe: 12.0, MNT: 0.0,
};

// Mulberry32 deterministic PRNG
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s: string) {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return h;
}

function buildSimulation(
  blendedApy: number,
  volatility: number,
  capital: number,
  days: number,
  seedKey: string,
): { apyPoints: { time: UTCTimestamp; value: number }[]; valuePoints: { time: UTCTimestamp; value: number }[] } {
  const rand = mulberry32(strSeed(seedKey) + days);
  const d = new Date();
  const startMs = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  let apy = blendedApy * (0.88 + rand() * 0.24);
  let portfolio = capital;
  const apyPoints: { time: UTCTimestamp; value: number }[] = [];
  const valuePoints: { time: UTCTimestamp; value: number }[] = [];

  for (let i = 0; i <= days; i++) {
    const dayTs = ((startMs + i * 86_400_000) / 1000) as UTCTimestamp;

    const noise = (rand() - 0.5) * volatility;
    const reversion = (blendedApy - apy) * 0.07;
    apy = Math.max(0.1, apy + noise + reversion);

    portfolio *= 1 + apy / 100 / 365;

    apyPoints.push({ time: dayTs, value: Math.round(apy * 100) / 100 });
    valuePoints.push({ time: dayTs, value: Math.round(portfolio * 100) / 100 });
  }

  return { apyPoints, valuePoints };
}

function useSimChart(
  containerRef: React.RefObject<HTMLDivElement | null>,
  lineColor: string,
  topColor: string,
): { chartRef: React.MutableRefObject<IChartApi | null>; seriesRef: React.MutableRefObject<ISeriesApi<"Area"> | null> } {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5B7490",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(91,116,144,0.08)" },
        horzLines: { color: "rgba(91,116,144,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(91,116,144,0.15)" },
      timeScale: { borderColor: "rgba(91,116,144,0.15)", timeVisible: false },
      crosshair: { horzLine: { visible: true }, vertLine: { visible: true } },
      height: 180,
      autoSize: true,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor: "rgba(0,0,0,0.01)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { chartRef, seriesRef };
}

export function SimulateTab({ initialCapital }: { initialCapital?: number }) {
  const [strategy, setStrategy] = useState<StrategyId>("LOW");
  const [days, setDays] = useState(30);
  const [capital, setCapital] = useState(
    initialCapital != null && initialCapital > 0
      ? String(Math.round(initialCapital))
      : "1000",
  );
  const [customAlloc, setCustomAlloc] = useState<Record<string, string>>(
    Object.fromEntries(ALL_ASSETS.map((a) => [a, "0"])),
  );

  // Chart refs
  const apyContainerRef = useRef<HTMLDivElement>(null);
  const valContainerRef  = useRef<HTMLDivElement>(null);
  const { chartRef: apyChartRef, seriesRef: apySeriesRef } = useSimChart(
    apyContainerRef, "#1591DC", "rgba(21,145,220,0.25)",
  );
  const { chartRef: valChartRef, seriesRef: valSeriesRef } = useSimChart(
    valContainerRef, "#16A34A", "rgba(22,163,74,0.20)",
  );

  // Fetch live per-asset APY
  const { data: assetApy } = useQuery({
    queryKey: ["asset-apy-latest"],
    queryFn: async () => {
      const results = await Promise.all(
        ALL_ASSETS.map((asset) =>
          apiFetch<{ history: { apy: string }[] }>(
            `/api/apy/history?asset=${asset}&days=1`, null,
          )
            .then((r) => {
              const h = r.history ?? [];
              const latest = h[h.length - 1];
              return { asset, apy: latest ? Number(latest.apy) : (FALLBACK_APY[asset] ?? 0) };
            })
            .catch(() => ({ asset, apy: FALLBACK_APY[asset] ?? 0 })),
        ),
      );
      return Object.fromEntries(results.map((r) => [r.asset, r.apy]));
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const apyMap = assetApy ?? FALLBACK_APY;
  const isCustom = strategy === "CUSTOM";

  const alloc: Record<string, number> = isCustom
    ? Object.fromEntries(ALL_ASSETS.map((a) => [a, Number(customAlloc[a]) || 0]))
    : (PRESET_ALLOCATIONS[strategy] ?? {});

  const totalCustomPct = Object.values(alloc).reduce((s, v) => s + v, 0);
  const customValid = !isCustom || totalCustomPct === 100;

  const rows = Object.entries(alloc)
    .filter(([, w]) => w > 0)
    .map(([asset, weight]) => ({
      asset,
      weight,
      apy:          apyMap[asset] ?? FALLBACK_APY[asset] ?? 0,
      contribution: ((apyMap[asset] ?? FALLBACK_APY[asset] ?? 0) * weight) / 100,
    }));

  const blendedApy   = rows.reduce((s, r) => s + r.contribution, 0);
  const capitalNum   = Number(capital);
  const annualYield  = capitalNum * blendedApy / 100;
  const monthlyYield = annualYield / 12;
  const dailyYield   = annualYield / 365;
  const showResults  = capitalNum > 0 && blendedApy > 0 && customValid && rows.length > 0;

  // Volatility derived from allocation mix
  const ASSET_VOL: Record<string, number> = {
    mUSD: 0.05, USDY: 0.05, mETH: 0.30, cmETH: 0.35, sUSDe: 0.70, MNT: 0.20,
  };
  const volatility = rows.reduce(
    (s, r) => s + (ASSET_VOL[r.asset] ?? 0.2) * (r.weight / 100),
    0,
  );

  // Seed key changes when strategy/custom allocation changes
  const seedKey = isCustom
    ? ALL_ASSETS.map((a) => customAlloc[a]).join("-")
    : strategy;

  // Update charts when inputs change
  useEffect(() => {
    if (!apySeriesRef.current || !valSeriesRef.current) return;
    if (!customValid || blendedApy <= 0 || capitalNum <= 0) return;

    const { apyPoints, valuePoints } = buildSimulation(
      blendedApy, volatility, capitalNum, days, seedKey,
    );
    apySeriesRef.current.setData(apyPoints);
    apyChartRef.current?.timeScale().fitContent();
    valSeriesRef.current.setData(valuePoints);
    valChartRef.current?.timeScale().fitContent();
  }, [blendedApy, volatility, capitalNum, days, seedKey, customValid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="space-y-6">

        {/* Capital input */}
        <div className="max-w-xs">
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
            Capital (USDC)
          </label>
          <Input
            type="number"
            min="0"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            className="font-mono"
          />
        </div>

        {/* Strategy + Range selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-fit gap-1 rounded-lg border border-[#DDE8F2] p-0.5 dark:border-white/10">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
                  strategy === s.id
                    ? "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15"
                    : "text-[#5B7490] dark:text-white/45",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-[#DDE8F2] p-0.5 dark:border-white/10">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-md px-2 py-1.5 font-mono text-xs transition-colors",
                  days === r.days
                    ? "bg-[#EAF4FC] text-[#1591DC] dark:bg-[#1591DC]/15"
                    : "text-[#5B7490] dark:text-white/45",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom allocation inputs */}
        {isCustom && (
          <div className="rounded-xl border border-[#DDE8F2] p-4 dark:border-white/10">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
              Custom allocation
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ALL_ASSETS.map((asset) => (
                <div key={asset}>
                  <label className="mb-1 block font-mono text-xs text-[#5B7490] dark:text-white/45">
                    {asset} %
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={customAlloc[asset]}
                    onChange={(e) =>
                      setCustomAlloc((prev) => ({ ...prev, [asset]: e.target.value }))
                    }
                    className="font-mono"
                  />
                </div>
              ))}
            </div>
            <p className={cn("mt-2 font-mono text-xs", totalCustomPct === 100 ? "text-[#16A34A]" : "text-[#DC2626]")}>
              Total: {totalCustomPct}% {totalCustomPct === 100 ? "✓" : "— must equal 100%"}
            </p>
          </div>
        )}

        {/* Asset breakdown table */}
        {rows.length > 0 && customValid && (
          <div className="overflow-hidden rounded-xl border border-[#DDE8F2] dark:border-white/10">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#DDE8F2] dark:border-white/10">
                  {["Asset", "Allocation", "APY / yr", "Contribution"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-mono text-[0.65rem] uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.asset} className={cn(i < rows.length - 1 && "border-b border-[#DDE8F2] dark:border-white/10")}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-[#0C1A2B] dark:text-white">{r.asset}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#5B7490] dark:text-white/45">{r.weight}%</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#0C1A2B] dark:text-white">{r.apy.toFixed(2)}%</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1591DC]">+{r.contribution.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#DDE8F2] bg-[#F7F9FC] dark:border-white/10 dark:bg-white/[0.03]">
                  <td colSpan={3} className="px-4 py-3 font-mono text-xs font-semibold text-[#0C1A2B] dark:text-white">
                    Blended APY
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-[#1591DC]">
                    {blendedApy.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Yield results */}
        {showResults && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Annual yield",  value: annualYield },
              { label: "Monthly yield", value: monthlyYield },
              { label: "Daily yield",   value: dailyYield },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-[#DDE8F2] p-4 dark:border-white/[0.08]">
                <p className="font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">{label}</p>
                <p className="mt-1 font-mono text-xl font-bold text-[#16A34A]">{formatUSD(value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts — APY projection + Portfolio growth */}
        {showResults && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
                APY Projection
              </p>
              <div ref={apyContainerRef} className="h-[180px] w-full" />
            </div>
            <div>
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.06em] text-[#5B7490] dark:text-white/45">
                Portfolio Growth
              </p>
              <div ref={valContainerRef} className="h-[180px] w-full" />
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}
