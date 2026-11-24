import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { logger } from "../logging/logger.js";

export interface RateLimitStore {
  take(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  };
}

class SlidingWindowStore implements RateLimitStore {
  private buckets = new Map<string, number[]>();

  take(key: string, limit: number, windowMs: number, now: number) {
    const cutoff = now - windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (time) => time > cutoff,
    );
    if (timestamps.length >= limit) {
      this.buckets.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetAt: timestamps[0]! + windowMs,
      };
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      resetAt: timestamps[0]! + windowMs,
    };
  }
}

export const inMemoryRateLimitStore = new SlidingWindowStore();

export function createRateLimitMiddleware(
  store: RateLimitStore = inMemoryRateLimitStore,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const caller = req.callingService ?? req.ip ?? "anonymous";
    const agent = req.baseUrl.split("/").filter(Boolean).at(-1) ?? "unknown";
    const configuredLimits = env.agentRateLimits ?? {};
    const limit = configuredLimits[agent] ?? env.agentRateLimitPerMinute ?? 60;
    const now = Date.now();
    const windowMs = 60_000;
    const key = `${caller}:${agent}`;
    const result = store.take(key, limit, windowMs, now);

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(result.resetAt / 1000)),
    );

    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      logger.warn(
        { caller, agent, limit, event: "rate_limit_rejected" },
        "agent run rate limit exceeded",
      );
      res.status(429).json({ error: "rate_limited", retryAfter });
      return;
    }
    next();
  };
}

export const rateLimit = createRateLimitMiddleware();
