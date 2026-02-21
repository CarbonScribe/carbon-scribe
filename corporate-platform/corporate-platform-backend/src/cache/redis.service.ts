import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Cluster, RedisOptions } from 'ioredis';

export type RedisClient = Redis | Cluster;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient;
  private healthy = false;

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
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = Number(process.env.REDIS_PORT || 6379);
        const password = process.env.REDIS_PASSWORD;
        this.client = new Redis({
          host,
          port,
          password,
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
