import type { MiddlewareHandler } from "hono";
import { env } from "../config/env.js";

export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/** In-memory fixed-window rate limiter. Pure given an explicit `now` (testable). */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now: number): RateResult {
    const e = this.hits.get(key);
    if (!e || now >= e.resetAt) {
      const resetAt = now + this.windowMs;
      this.hits.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.max - 1, resetAt };
    }
    e.count += 1;
    return {
      allowed: e.count <= this.max,
      remaining: Math.max(0, this.max - e.count),
      resetAt: e.resetAt,
    };
  }
}

/** Hono middleware: limit per client IP (first X-Forwarded-For hop). */
export function makeRateLimit(limiter: RateLimiter): MiddlewareHandler {
  return async (c, next) => {
    const key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const { allowed, remaining, resetAt } = limiter.hit(key, Date.now());
    c.header("X-RateLimit-Remaining", String(remaining));
    if (!allowed) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))));
      return c.json({ error: "rate limit exceeded" }, 429);
    }
    await next();
  };
}

export const rateLimit = makeRateLimit(
  new RateLimiter(env.RATE_LIMIT_MAX, env.RATE_LIMIT_WINDOW_SEC * 1000),
);
