import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeRun,
  scheduleJobs,
  buildJobs,
  startScheduler,
  stopScheduler,
  type ScheduledJob,
  type SchedulerTimers,
} from "./scheduler.js";

const flush = () => new Promise((r) => setImmediate(r));

function fakeTimers() {
  const scheduled: { fn: () => void; ms: number }[] = [];
  const cleared: unknown[] = [];
  const timers: SchedulerTimers = {
    setInterval: ((fn: () => void, ms: number) => {
      const handle = { fn, ms };
      scheduled.push({ fn, ms });
      return handle as unknown as ReturnType<typeof setInterval>;
    }) as SchedulerTimers["setInterval"],
    clearInterval: (h) => void cleared.push(h),
  };
  return { timers, scheduled, cleared };
}

const job = (over: Partial<ScheduledJob> = {}): ScheduledJob => ({
  name: "job",
  enabled: true,
  intervalMs: 1000,
  run: async () => {},
  ...over,
});

test("safeRun: swallows job errors (loop never dies)", async () => {
  await assert.doesNotReject(() =>
    safeRun(job({ run: async () => { throw new Error("boom"); } })),
  );
});

test("safeRun: runs a healthy job", async () => {
  let ran = false;
  await safeRun(job({ run: async () => { ran = true; } }));
  assert.equal(ran, true);
});

test("scheduleJobs: only enabled jobs get an interval, with correct period", () => {
  const { timers, scheduled } = fakeTimers();
  scheduleJobs(
    [
      job({ name: "on", enabled: true, intervalMs: 1000 }),
      job({ name: "off", enabled: false, intervalMs: 2000 }),
    ],
    timers,
  );
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]!.ms, 1000);
});

test("scheduleJobs: runs immediately on boot, then on each interval tick", async () => {
  let runs = 0;
  const { timers, scheduled } = fakeTimers();
  scheduleJobs([job({ run: async () => { runs += 1; } })], timers);

  await flush();
  assert.equal(runs, 1, "immediate run");

  scheduled[0]!.fn(); // simulate an interval firing
  await flush();
  assert.equal(runs, 2, "interval run");
});

test("scheduleJobs: a failing job is isolated and still scheduled", async () => {
  const { timers, scheduled } = fakeTimers();
  scheduleJobs([job({ run: async () => { throw new Error("nope"); } })], timers);
  await flush(); // immediate run rejects internally but must not throw
  assert.equal(scheduled.length, 1);
});

test("buildJobs: exposes the scheduled jobs gated by env", () => {
  const jobs = buildJobs();
  assert.deepEqual(jobs.map((j) => j.name), [
    "relayer",
    "rebalancer",
    "price-monitor",
    "apy-scraper",
    "pnl-snapshot",
  ]);
  assert.ok(jobs.every((j) => typeof j.enabled === "boolean" && j.intervalMs > 0));
});

test("startScheduler schedules exactly the enabled jobs; stopScheduler clears them", () => {
  const { timers, scheduled, cleared } = fakeTimers();
  const enabledCount = buildJobs().filter((j) => j.enabled).length;
  startScheduler(timers);
  assert.equal(scheduled.length, enabledCount);
  stopScheduler(timers);
  assert.equal(cleared.length, enabledCount);
});
