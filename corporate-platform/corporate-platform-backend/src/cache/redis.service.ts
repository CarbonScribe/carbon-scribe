import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis, { Cluster, RedisOptions } from 'ioredis';
import { ConfigService } from '../config/config.service';

export type RedisClient = Redis | Cluster;

/**
 * NOTE on the two RedisService implementations (#650):
 *
 * This file and src/shared/cache/redis.service.ts both define an
 * `@Injectable() class RedisService` — two separate NestJS providers (one
 * per module they're registered in), each opening its own ioredis
 * connection to the same Redis instance. They are NOT the same class and
 * NestJS's DI never confuses them, but a bug fix (like this one) or a
 * config change applied to one does not automatically apply to the other.
 *
 * This one (cluster/sentinel-aware, synchronous cached `isHealthy()`) is
 * used by: team-collaboration's gateway/services, config's
 * module/service-validator, and retirement/idempotency's
 * IdempotencyKeyService.
 *
 * src/shared/cache/redis.service.ts (per-command timeouts, exponential
 * backoff retry strategy, async ping-based `isHealthy()`) is used by:
 * health.service.ts and rate-limit's module/service.
 *
 * Consolidating them into one shared provider is tracked as a follow-up,
 * not done as part of #650 — it would mean reconciling two different
 * `isHealthy()` contracts (sync/cached here vs. async/live-ping there)
 * across every consumer above, which is a larger change than the
 * idempotency-lock fail-fast behavior #650 actually needs. Until then: a
 * future Redis-availability fix needs to be checked against both files.
 */
@Injectable()
export class RedisService
  implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap
{
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient;
  private healthy = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const useCluster = process.env.REDIS_CLUSTER === 'true';
    const useSentinel = process.env.REDIS_SENTINEL === 'true';
    try {
      if (useCluster) {
        const nodes = (process.env.REDIS_CLUSTER_NODES || '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            const [host, port] = n.split(':');
            return { host, port: Number(port || 6379) };
          });
        this.client = new Redis.Cluster(nodes);
      } else if (useSentinel) {
        const sentinels = (process.env.REDIS_SENTINELS || '')
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => {
            const [host, port] = n.split(':');
            return { host, port: Number(port || 26379) };
          });
        const name = process.env.REDIS_SENTINEL_NAME || 'mymaster';
        this.client = new Redis({
          sentinels,
          name,
        } as RedisOptions);
      } else {
        const config = this.configService.getRedisConfig();
        this.client = new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          maxRetriesPerRequest: 3,
        });
      }

      this.client.on('ready', () => {
        this.healthy = true;
      });
      this.client.on('error', (err) => {
        this.healthy = false;
        this.logger.error(err.message);
      });
      await this.client.ping();
      this.healthy = true;
    } catch (e) {
      this.healthy = false;
      this.logger.error(e.message);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): RedisClient {
    return this.client;
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async onApplicationBootstrap() {
    if (this.client && this.healthy) {
      await this.client.set('cache:warmup:timestamp', Date.now().toString());
    }
  }
}
