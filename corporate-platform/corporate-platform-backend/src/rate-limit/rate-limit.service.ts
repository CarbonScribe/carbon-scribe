import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../shared/cache/redis.service';
import {
  RateLimitConfig,
  RateLimitResult,
  RateLimitViolation,
  RateLimitMetrics,
} from './rate-limit.types';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly defaultWindowMs = 60000; // 1 minute
  private readonly defaultMaxRequests = 10;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Check if a request is allowed under the rate limit
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const client = this.redisService.getClient();
    const redisKey = this.buildRedisKey(config.keyPrefix, key);
    const now = Date.now();

    try {
      // Get current count and reset time
      const multi = client.multi();
      multi.get(redisKey);
      multi.ttl(redisKey);
      const results = await multi.exec();

      let current = parseInt((results?.[0]?.[1] as string) || '0', 10);
      let ttl = results?.[1]?.[1] as number;

      // If key doesn't exist or expired, reset
      if (isNaN(current) || current === 0 || ttl < 0) {
        current = 0;
        ttl = Math.ceil(config.windowMs / 1000);
      }

      // Check if request is allowed
      const allowed = current < config.maxRequests;

      // Increment counter
      if (allowed) {
        await client.incr(redisKey);
        // Set expiry if this is the first request
        if (current === 0) {
          await client.expire(redisKey, Math.ceil(config.windowMs / 1000));
        }
      }

      const resetTime = now + (ttl > 0 ? ttl * 1000 : config.windowMs);

      // Calculate retry after for blocked requests
      let retryAfter: number | undefined;
      if (!allowed) {
        retryAfter = Math.ceil(ttl);
      }

      return {
        allowed,
        current: allowed ? current + 1 : current,
        max: config.maxRequests,
        resetTime,
        retryAfter,
        windowMs: config.windowMs,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Rate limit check failed for key ${redisKey}: ${err.message}`,
      );

      // On error, allow the request if configured to skip on error
      if (config.skipOnError) {
        return {
          allowed: true,
          current: 0,
          max: config.maxRequests,
          resetTime: now + config.windowMs,
          windowMs: config.windowMs,
        };
      }

      throw error;
    }
  }

  /**
   * Log a rate limit violation
   */
  async logViolation(violation: RateLimitViolation): Promise<void> {
    const client = this.redisService.getClient();
    const violationKey = `rate-limit:violations:${violation.endpoint}`;
    const key = `rate-limit:violations:${violation.endpoint}:${new Date().toISOString().slice(0, 10)}`;

    try {
      // Increment violation counter
      await client.incr(key);
      await client.expire(key, 86400 * 7); // 7 days

      // Store violation details
      const violationLog = {
        ...violation,
        timestamp: violation.timestamp.toISOString(),
      };

      await client.lpush(violationKey, JSON.stringify(violationLog));
      await client.ltrim(violationKey, 0, 999); // Keep last 1000 violations

      this.logger.warn(`Rate limit violation: ${violation.endpoint}`, {
        userId: violation.userId,
        companyId: violation.companyId,
        ip: violation.ip,
        key: violation.key,
        current: violation.current,
        max: violation.max,
        resetTime: new Date(violation.resetTime).toISOString(),
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to log rate limit violation: ${err.message}`);
    }
  }

  /**
   * Check if rate limiting should use graduated cooldown
   */
  async getGraduatedCooldown(key: string, windowMs: number): Promise<number> {
    const client = this.redisService.getClient();
    const violationKey = `rate-limit:violations:${key}`;

    try {
      // Get recent violation count
      const count = await client.get(violationKey);
      const violations = parseInt(count || '0', 10);

      // Calculate cooldown multiplier: 2^violations (capped at 8)
      const multiplier = Math.min(Math.pow(2, violations), 8);

      // Base cooldown is the window duration
      return windowMs * multiplier;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get graduated cooldown: ${err.message}`);
      return windowMs;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string, keyPrefix: string): Promise<void> {
    const client = this.redisService.getClient();
    const redisKey = this.buildRedisKey(keyPrefix, key);

    try {
      await client.del(redisKey);
      this.logger.debug(`Reset rate limit for key: ${redisKey}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to reset rate limit: ${err.message}`);
    }
  }

  /**
   * Get metrics for an endpoint
   */
  async getMetrics(endpoint: string): Promise<RateLimitMetrics> {
    const client = this.redisService.getClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    try {
      const [requests, blocked, violations, totalRequests, allowedRequests] =
        await Promise.all([
          client.get(`rate-limit:requests:${endpoint}:${today}`),
          client.get(`rate-limit:blocked:${endpoint}:${today}`),
          client.llen(`rate-limit:violations:${endpoint}`),
          client.get(`rate-limit:total-requests:${endpoint}:${today}`),
          client.get(`rate-limit:allowed-requests:${endpoint}:${today}`),
        ]);

      const requestsCount = parseInt(requests || '0', 10);
      const blockedCount = parseInt(blocked || '0', 10);
      const violationsCount = violations || 0;
      const total = parseInt(totalRequests || '0', 10);
      const allowed = parseInt(allowedRequests || '0', 10);

      return {
        totalRequests: total || requestsCount + blockedCount,
        allowedRequests: allowed || requestsCount,
        blockedRequests: blockedCount,
        violations: violationsCount,
        byEndpoint: {
          [endpoint]: {
            requests: requestsCount,
            blocked: blockedCount,
          },
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get metrics: ${err.message}`);
      return {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        violations: 0,
        byEndpoint: {},
      };
    }
  }

  /**
   * Get all metrics for all endpoints
   */
  async getAllMetrics(): Promise<RateLimitMetrics> {
    const client = this.redisService.getClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    try {
      // Get all keys matching pattern
      const keys = await client.keys(`rate-limit:requests:*:${today}`);
      const metrics: RateLimitMetrics = {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        violations: 0,
        byEndpoint: {},
      };

      for (const key of keys) {
        const endpoint = key.split(':')[2];
        const [requests, blocked, violations] = await Promise.all([
          client.get(key),
          client.get(`rate-limit:blocked:${endpoint}:${today}`),
          client.llen(`rate-limit:violations:${endpoint}`),
        ]);

        const requestsCount = parseInt(requests || '0', 10);
        const blockedCount = parseInt(blocked || '0', 10);

        metrics.totalRequests += requestsCount + blockedCount;
        metrics.allowedRequests += requestsCount;
        metrics.blockedRequests += blockedCount;
        metrics.violations += violations || 0;
        metrics.byEndpoint[endpoint] = {
          requests: requestsCount,
          blocked: blockedCount,
        };
      }

      return metrics;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get all metrics: ${err.message}`);
      return {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        violations: 0,
        byEndpoint: {},
      };
    }
  }

  /**
   * Build Redis key from prefix and identifier
   */
  private buildRedisKey(prefix: string, key: string): string {
    return `rate-limit:${prefix}:${key}`;
  }

  /**
   * Extract IP from request, handling proxies
   */
  getClientIp(
    headers: Record<string, string | string[]>,
    connection: any,
  ): string {
    const forwarded = headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
      return ips[0]?.trim() || 'unknown';
    }

    const realIp = headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return connection?.remoteAddress || 'unknown';
  }
}
