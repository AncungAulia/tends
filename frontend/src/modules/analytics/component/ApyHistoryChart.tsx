"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createChart,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Card } from "@/components/elements/Card";
import { Skeleton } from "@/components/elements/Skeleton";
import { apiFetch } from "@/lib/api";
import { cn } from "@/utils/cn";

const ASSETS = ["mETH", "USDY", "XAU", "AAPL"];
const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

interface ApyPoint {
  asset: string;
  apy: string; // backend returns APY as a string, e.g. "3.5"
  snapshotAt: string; // ISO timestamp
}

export function ApyHistoryChart() {
  const [asset, setAsset] = useState("mETH");
  const [days, setDays] = useState(30);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["apy-history", asset, days],
    queryFn: () =>
      apiFetch<{ history: ApyPoint[] }>(
        `/api/apy/history?asset=${asset}&days=${days}`,
        null,
      ).then((r) => r.history ?? []),
  });

  // Create the chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5B7490",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(91,116,144,0.1)" },
        horzLines: { color: "rgba(91,116,144,0.1)" },
      },
      rightPriceScale: { borderColor: "rgba(91,116,144,0.2)" },
      timeScale: { borderColor: "rgba(91,116,144,0.2)" },
      height: 240,
      autoSize: true,
    });
    const series = chart.addSeries(LineSeries, {
      color: "#1591DC",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data whenever it changes
  useEffect(() => {
    if (!seriesRef.current || !data) return;
    seriesRef.current.setData(
      data.map((p) => ({
        time: (new Date(p.snapshotAt).getTime() / 1000) as UTCTimestamp,
        value: Number(p.apy),
      })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-sans text-sm font-semibold text-[#0C1A2B] dark:text-white">
          APY History
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="rounded-lg border border-[#DDE8F2] bg-white px-2 py-1 font-mono text-xs dark:border-white/10 dark:bg-[#0F2035] dark:text-white"
          >
            {ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
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
        {!isLoading && isError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-center">
            <p className="text-sm text-[#5B7490] dark:text-white/45">
              APY history is temporarily unavailable.
            </p>
          </div>
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm text-[#5B7490] dark:text-white/45">
              No APY history for {asset} yet.
            </p>
            <p className="text-xs text-[#5B7490]/60 dark:text-white/30">
              Try mETH or USDY.
            </p>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </Card>
  );
}
