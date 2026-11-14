import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheEvictOptions, CacheStats } from './cache.interfaces';
import { CACHE_STATS_KEY } from './cache.constants';
import { gzipSync, gunzipSync } from 'zlib';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  private async withClient<T>(
    fn: (client: any) => Promise<T>,
  ): Promise<T | undefined> {
    const client = this.redisService.getClient();
    if (!client || !this.redisService.isHealthy()) {
      return undefined;
    }
    try {
      return await fn(client);
    } catch (e) {
      this.logger.error(e.message);
      return undefined;
    }
  }

  private encodeEnvelope<T>(value: T): string {
    const payloadString = JSON.stringify(value);
    let compressed = false;
    let data: string;
    const buffer = Buffer.from(payloadString, 'utf8');
    if (buffer.length > 1024) {
      compressed = true;
      data = gzipSync(buffer).toString('base64');
    } else {
      data = buffer.toString('utf8');
    }
    return JSON.stringify({ compressed, data });
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.withClient<string>((c) => c.get(key));
    if (!raw) {
      await this.incrementMiss();
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw);
      let dataBuffer: Buffer;
      if (parsed.compressed) {
        dataBuffer = gunzipSync(Buffer.from(parsed.data, 'base64'));
      } else {
        dataBuffer = Buffer.from(parsed.data, 'utf8');
      }
      const value = JSON.parse(dataBuffer.toString('utf8'));
      await this.incrementHit();
      return value as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    tags?: string[],
  ): Promise<void> {
    const envelope = this.encodeEnvelope(value);
    await this.withClient(async (c) => {
      if (ttlSeconds && ttlSeconds > 0) {
        await c.setex(key, ttlSeconds, envelope);
      } else {
        await c.set(key, envelope);
      }
      if (tags && tags.length) {
        for (const tag of tags) {
          await c.sadd(this.tagKey(tag), key);
        }
      }
    });
  }

  /**
   * Atomically sets `key` only if it does not already exist (`SET ... NX`).
   * Returns `true` when the key was newly claimed, `false` when it already
   * existed in Redis, or `undefined` if Redis is unavailable.
   */
  async setIfNotExists<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<boolean | undefined> {
    const envelope = this.encodeEnvelope(value);
    return this.withClient<boolean>(async (c) => {
      const result =
        ttlSeconds && ttlSeconds > 0
          ? await c.set(key, envelope, 'EX', ttlSeconds, 'NX')
          : await c.set(key, envelope, 'NX');
      return result === 'OK';
    });
  }

  async mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    const results = await this.withClient<string[]>((c) => c.mget(keys));
    if (!results) {
      return keys.map(() => undefined);
    }
    return Promise.all(
      results.map(async (raw) => {
        if (!raw) {
          await this.incrementMiss();
          return undefined;
        }
        try {
          const parsed = JSON.parse(raw);
          let dataBuffer: Buffer;
          if (parsed.compressed) {
            dataBuffer = gunzipSync(Buffer.from(parsed.data, 'base64'));
          } else {
            dataBuffer = Buffer.from(parsed.data, 'utf8');
          }
          const value = JSON.parse(dataBuffer.toString('utf8'));
          await this.incrementHit();
          return value as T;
        } catch {
          return undefined;
        }
      }),
    );
  }

  async mset<T>(
    entries: { key: string; value: T; ttlSeconds?: number; tags?: string[] }[],
  ): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttlSeconds, entry.tags);
    }
  }

  async del(key: string): Promise<void> {
    await this.withClient((c) => c.del(key));
  }

  async delByPattern(pattern: string): Promise<void> {
    await this.withClient(async (c) => {
      const keys = await c.keys(pattern);
      if (keys.length) {
        await c.del(keys);
      }
    });
  }

  async evict(options: CacheEvictOptions): Promise<void> {
    await this.withClient(async () => {
      if (options.keys) {
        for (const key of options.keys) {
          await this.del(key);
        }
      }
      if (options.patterns) {
        for (const pattern of options.patterns) {
          await this.delByPattern(pattern);
        }
      }
      if (options.tags) {
        for (const tag of options.tags) {
          await this.invalidateTag(tag);
        }
      }
    });
  }

  async invalidateTag(tag: string): Promise<void> {
    await this.withClient(async (c) => {
      const tagKey = this.tagKey(tag);
      const members = await c.smembers(tagKey);
      if (members.length) {
        await c.del(members);
      }
      await c.del(tagKey);
    });
  }

  async warmup(): Promise<void> {
    await this.withClient(async () => undefined);
  }

  async getStats(): Promise<CacheStats> {
    const base: CacheStats = { hits: 0, misses: 0, keys: 0 };
    const statsRaw = await this.withClient<string>((c) =>
      c.get(CACHE_STATS_KEY),
    );
    if (statsRaw) {
      try {
        const parsed = JSON.parse(statsRaw);
        base.hits = parsed.hits || 0;
        base.misses = parsed.misses || 0;
      } catch {}
    }
    const info = await this.withClient((c) => c.info('stats'));
    if (info) {
      const lines = (info as string).split('\n');
      for (const line of lines) {
        if (line.startsWith('db0:')) {
          const parts = line.split(',');
          for (const part of parts) {
            if (part.startsWith('keys=')) {
              base.keys = Number(part.split('=')[1]) || 0;
            }
          }
        }
        if (line.startsWith('used_memory:')) {
          base.memoryUsage = Number(line.split(':')[1]) || undefined;
        }
        if (line.startsWith('evicted_keys:')) {
          base.evictions = Number(line.split(':')[1]) || undefined;
        }
      }
    }
    return base;
  }

  private async incrementHit(): Promise<void> {
    await this.incrementField('hits');
  }

  private async incrementMiss(): Promise<void> {
    await this.incrementField('misses');
  }

  private async incrementField(field: 'hits' | 'misses'): Promise<void> {
    await this.withClient(async (c) => {
      const current = await c.get(CACHE_STATS_KEY);
      let stats = { hits: 0, misses: 0 };
      if (current) {
        try {
          stats = JSON.parse(current);
        } catch {}
      }
      stats[field] += 1;
      await c.set(CACHE_STATS_KEY, JSON.stringify(stats));
    });
  }

  private tagKey(tag: string): string {
    return `tag:${tag}`;
  }
}
