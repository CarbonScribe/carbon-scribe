import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Simple in-process sliding-window rate limiter for audit endpoints.
 *
 * Keyed by `companyId` (from the JWT payload if present) or IP address,
 * preventing any single tenant from flooding the expensive on-chain
 * anchor or verify operations.
 *
 * Limits (configurable via env vars):
 *   AUDIT_ANCHOR_RATE_LIMIT_MAX   — max requests per window  (default: 30)
 *   AUDIT_ANCHOR_RATE_LIMIT_WINDOW_MS — window in ms        (default: 60_000)
 *
 * For production deployments behind multiple instances, replace this with a
 * Redis-backed rate limiter (e.g. @nestjs/throttler with redis store).
 */
@Injectable()
export class AuditRateLimitMiddleware implements NestMiddleware {
  private readonly windowMs: number;
  private readonly maxRequests: number;

  /** Map<tenantKey, timestamps[]> */
  private readonly requestLog = new Map<string, number[]>();

  constructor() {
    this.windowMs = Number(process.env.AUDIT_ANCHOR_RATE_LIMIT_WINDOW_MS ?? 60_000);
    this.maxRequests = Number(process.env.AUDIT_ANCHOR_RATE_LIMIT_MAX ?? 30);
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user as
      | { companyId?: string; sub?: string }
      | undefined;

    // Key by companyId when available; fall back to IP
    const key = user?.companyId || req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = (this.requestLog.get(key) ?? []).filter(
      (t) => t > windowStart,
    );

    if (timestamps.length >= this.maxRequests) {
      throw new HttpException(
        `Audit endpoint rate limit exceeded. Max ${this.maxRequests} requests per ${this.windowMs / 1000}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    timestamps.push(now);
    this.requestLog.set(key, timestamps);

    next();
  }
}
