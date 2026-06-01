"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card } from "@/components/elements/Card";
import { Skeleton } from "@/components/elements/Skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/utils/cn";

const STRATEGIES = [
  { id: "LOW", label: "Low" },
  { id: "MEDIUM", label: "Medium" },
  { id: "HIGH", label: "High" },
] as const;
type StrategyId = (typeof STRATEGIES)[number]["id"];

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

interface ApyPoint {
  asset: string;
  apy: string;
  snapshotAt: string;
}

// Asset allocations per strategy (mirrors backend resolveTargetBps)
const STRATEGY_ALLOCATIONS: Record<string, Array<{ asset: string; weight: number }>> = {
  LOW:    [{ asset: "mUSD", weight: 0.9 }, { asset: "USDY", weight: 0.1 }],
  MEDIUM: [{ asset: "mUSD", weight: 0.4 }, { asset: "mETH", weight: 0.3 }, { asset: "cmETH", weight: 0.3 }],
  HIGH:   [{ asset: "cmETH", weight: 0.4 }, { asset: "sUSDe", weight: 0.3 }, { asset: "mETH", weight: 0.2 }, { asset: "MNT", weight: 0.1 }],
};

// Fallback blended APY when no real data is available
const BASE_APY: Record<string, number> = {
  LOW: 5.0, MEDIUM: 4.25, HIGH: 5.9,
};
const VOLATILITY: Record<string, number> = {
  LOW: 0.12, MEDIUM: 0.28, HIGH: 0.65,
};

// Deterministic PRNG (Mulberry32) — same strategy → same chart shape every render
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

function buildChartData(
  asset: string,
  days: number,
  raw: { time: UTCTimestamp; value: number }[],
): { time: UTCTimestamp; value: number }[] {
  // Always simulate forward from today — raw data only anchors the starting APY
  const anchor =
    raw.length > 0 ? raw[raw.length - 1].value : (BASE_APY[asset] ?? 3.5);
  const vol = VOLATILITY[asset] ?? 0.4;
  const rand = mulberry32(strSeed(asset) + days);

  const numPoints = days; // one point per day
  // Start from local-date midnight (today in user's timezone)
  const _d = new Date();
  const startMs = Date.UTC(_d.getFullYear(), _d.getMonth(), _d.getDate());

  let apy = anchor * (0.88 + rand() * 0.24);
  const points: { time: UTCTimestamp; value: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const dayTs = (startMs + i * 86_400_000) / 1000; // forward from today, in seconds

    const noise = (rand() - 0.5) * vol;
    const reversion = (anchor - apy) * 0.07;
    apy = Math.max(0.1, apy + noise + reversion);

    points.push({ time: dayTs as UTCTimestamp, value: Math.round(apy * 100) / 100 });
  }

  return points;
}

export function ApyHistoryChart() {
  const [strategy, setStrategy] = useState<StrategyId>("LOW");
  const [days, setDays] = useState(30);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ["apy-history", strategy, days],
    queryFn: async (): Promise<ApyPoint[]> => {
      const allocations = STRATEGY_ALLOCATIONS[strategy] ?? [];
      const results = await Promise.all(
        allocations.map(({ asset }) =>
          apiFetch<{ history: ApyPoint[] }>(
            `/api/apy/history?asset=${asset}&days=${days}`,
            null,
          )
            .then((r) => ({ asset, history: r.history ?? [] }))
            .catch(() => ({ asset, history: [] as ApyPoint[] })),
        ),
      );

      // Group by minute-truncated timestamp, compute weighted blended APY
      const byMinute = new Map<string, number>();
      for (const { asset: a, history } of results) {
        const alloc = allocations.find((x) => x.asset === a)!;
        for (const pt of history) {
          const min = pt.snapshotAt.slice(0, 16);
          byMinute.set(min, (byMinute.get(min) ?? 0) + Number(pt.apy) * alloc.weight);
        }
      }

      return Array.from(byMinute.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([min, apy]) => ({
          asset: strategy,
          apy: String(Math.round(apy * 100) / 100),
          snapshotAt: min + ":00.000Z",
        }));
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  // Create chart once
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
      height: 240,
      autoSize: true,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#1591DC",
      topColor: "rgba(21,145,220,0.25)",
      bottomColor: "rgba(21,145,220,0.01)",
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
  }, []);

  // Update data when asset/range/raw changes
  useEffect(() => {
    if (!seriesRef.current || raw === undefined) return;

    const mapped = raw.map((p) => ({
      time: (new Date(p.snapshotAt).getTime() / 1000) as UTCTimestamp,
      value: Number(p.apy),
    }));

    const points = buildChartData(strategy, days, mapped);
    seriesRef.current.setData(points);
    chartRef.current?.timeScale().fitContent();
  }, [raw, strategy, days]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-sans text-sm font-semibold text-[#0C1A2B] dark:text-white">
          APY Projection
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[#DDE8F2] p-0.5 dark:border-white/10">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={cn(
                  "rounded-md px-2 py-1 font-mono text-xs",
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
                  "rounded-md px-2 py-1 font-mono text-xs",
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
      </div>

      <div className="relative h-60">
        {isLoading && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-xl" />
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </Card>
  );
}
