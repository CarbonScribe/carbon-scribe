import type { Request, RequestHandler } from "express";
import { env } from "../../config/env.js";
import { logger } from "../logging/logger.js";

export interface RateLimitStore {
  /**
   * Increments the request count for a given key within windowMs.
   * Returns the updated count and the timestamp (in ms) when the window/capacity resets.
   */
  increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetTime: number }>;
  reset?(key?: string): Promise<void>;
}

/**
 * In-memory sliding-window log rate limiter.
 * Preserves timestamps of hits within the sliding window, pruning expired entries.
 */
export class SlidingWindowMemoryStore implements RateLimitStore {
  private windows = new Map<string, number[]>();

  async increment(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const existing = this.windows.get(key) || [];
    const valid = existing.filter((t) => t > windowStart);
    valid.push(now);
    this.windows.set(key, valid);

    const oldest = valid[0];
    const resetTime = oldest + windowMs;
    return {
      count: valid.length,
      resetTime,
    };
  }

  async reset(key?: string): Promise<void> {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }
}

export const defaultRateLimitStore = new SlidingWindowMemoryStore();

export interface RateLimitOptions {
  windowMs?: number;
  max?: number | ((req: Request) => number);
  agent?: string;
  store?: RateLimitStore;
  keyGenerator?: (req: Request, agent?: string) => string;
}

export function getAgentRateLimit(agent?: string): number {
  if (agent === "discovery" && env.agentRateLimitDiscoveryPerMinute) {
    return env.agentRateLimitDiscoveryPerMinute;
  }
  if (agent === "pdd-draft" && env.agentRateLimitPddDraftPerMinute) {
    return env.agentRateLimitPddDraftPerMinute;
  }
  if (
    agent === "compliance-report" &&
    env.agentRateLimitComplianceReportPerMinute
  ) {
    return env.agentRateLimitComplianceReportPerMinute;
  }
  if (agent === "alert-triage" && env.agentRateLimitAlertTriagePerMinute) {
    return env.agentRateLimitAlertTriagePerMinute;
  }
  return env.agentRateLimitPerMinute ?? 60;
}

/**
 * Creates rate-limiting middleware keyed by calling service (or IP),
 * setting standard X-RateLimit-* headers and returning 429 when exceeded.
 */
export function createRateLimiter(
  options: RateLimitOptions = {},
): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const store = options.store ?? defaultRateLimitStore;

  return async (req, res, next) => {
    try {
      const caller =
        req.callingService ||
        req.ip ||
        req.socket?.remoteAddress ||
        "anonymous";
      const agent = options.agent;
      const key = options.keyGenerator
        ? options.keyGenerator(req, agent)
        : `rate-limit:${caller}${agent ? `:${agent}` : ""}`;

      const limit =
        typeof options.max === "function"
          ? options.max(req)
          : typeof options.max === "number"
            ? options.max
            : getAgentRateLimit(agent);

      const { count, resetTime } = await store.increment(key, windowMs);
      const remaining = Math.max(0, limit - count);
      const resetSeconds = Math.ceil(resetTime / 1000);

      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(resetSeconds));

      if (count > limit) {
        const now = Date.now();
        const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));
        res.setHeader("Retry-After", String(retryAfter));

        logger.warn(
          {
            caller,
            agent,
            path: req.path,
            count,
            limit,
            retryAfter,
          },
          "Rate limit exceeded",
        );

        res.status(429).json({
          error: "rate_limit_exceeded",
          message: "Too many requests, please try again later.",
          retryAfter,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function agentRateLimiter(agent: string): RequestHandler {
  return createRateLimiter({ agent });
}
