import { childLogger } from "./lib/logger.js";
import { env } from "./config/env.js";
import { relayerService } from "./services/relayer.js";
import { rebalancerService } from "./services/rebalancer.js";
import { priceMonitorService } from "./services/price-monitor.js";
import { apyService } from "./services/apy.js";
import { pnlService } from "./services/pnl.js";

const log = childLogger("scheduler");

export interface ScheduledJob {
  name: string;
  enabled: boolean;
  intervalMs: number;
  run: () => Promise<unknown>;
}

/** Timer functions, injectable so tests don't touch real timers. */
export interface SchedulerTimers {
  setInterval: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearInterval: (handle: ReturnType<typeof setInterval>) => void;
}

const realTimers: SchedulerTimers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h),
};

/** Run a job, swallowing errors so one bad cycle never kills the loop. */
export async function safeRun(job: ScheduledJob): Promise<void> {
  try {
    await job.run();
  } catch (err) {
    log.error({ job: job.name, err }, "scheduled job failed");
  }
}

/** The always-on jobs, built from env + services. */
export function buildJobs(): ScheduledJob[] {
  return [
    {
      name: "relayer",
      enabled: env.RELAYER_ENABLED,
      intervalMs: env.RELAYER_INTERVAL_SEC * 1000,
      run: () => relayerService.relayOnce(),
    },
    {
      name: "rebalancer",
      enabled: env.REBALANCER_ENABLED,
      intervalMs: env.REBALANCER_INTERVAL_SEC * 1000,
      run: () => rebalancerService.runOnce(),
    },
    {
      name: "price-monitor",
      enabled: env.PRICE_MONITOR_ENABLED,
      intervalMs: env.PRICE_MONITOR_INTERVAL_SEC * 1000,
      run: () =>
        priceMonitorService.guardAndMaybePause({
          enabled: env.RISK_AUTOPAUSE_ENABLED,
          listVaults: () => rebalancerService.listVaults(),
          pauseVault: (v, r) => priceMonitorService.pauseVault(v, r),
        }),
    },
    {
      name: "apy-scraper",
      enabled: env.APY_SCRAPER_ENABLED,
      intervalMs: env.APY_SCRAPER_INTERVAL_SEC * 1000,
      run: () => apyService.run(),
    },
    {
      name: "pnl-snapshot",
      enabled: env.PNL_SNAPSHOT_ENABLED,
      intervalMs: env.PNL_SNAPSHOT_INTERVAL_SEC * 1000,
      run: () => pnlService.run(),
    },
  ];
}

/** Schedule enabled jobs: run once immediately, then on their interval. */
export function scheduleJobs(
  jobs: ScheduledJob[],
  timers: SchedulerTimers = realTimers,
): ReturnType<typeof setInterval>[] {
  const handles: ReturnType<typeof setInterval>[] = [];
  for (const job of jobs) {
    if (!job.enabled) {
      log.info({ job: job.name }, "disabled, not scheduled");
      continue;
    }
    void safeRun(job); // kick off immediately on boot
    handles.push(timers.setInterval(() => void safeRun(job), job.intervalMs));
    log.info({ job: job.name, intervalMs: job.intervalMs }, "scheduled");
  }
  return handles;
}

let active: ReturnType<typeof setInterval>[] = [];

export function startScheduler(timers: SchedulerTimers = realTimers): void {
  active = scheduleJobs(buildJobs(), timers);
}

export function stopScheduler(timers: SchedulerTimers = realTimers): void {
  for (const h of active) timers.clearInterval(h);
  active = [];
}
