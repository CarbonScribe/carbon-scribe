import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '../../config/config.service';

/**
 * Redis service with timeout, retry, and connection management
 *
 * Features:
 * - Configurable timeout (default: 5000ms)
 * - Retry strategy with max attempts
 * - Connection timeout and idle timeout
 * - Automatic reconnection with backoff
 * - Health check support
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.getRedisConfig();
    this.timeout = redisConfig?.timeout || 5000;
    this.maxRetries = redisConfig?.maxRetries || 3;
    this.retryDelay = redisConfig?.retryDelay || 1000;
  }

  /**
   * Initialize Redis connection on module start
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Gracefully close Redis connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    await this.disconnect();
  }

  /**
   * Connect to Redis with timeout and retry configuration
   */
  async connect(): Promise<void> {
    if (this.client) {
      this.logger.debug('Redis client already connected');
      return;
    }

    const redisConfig = this.configService.getRedisConfig();
    const url =
      redisConfig?.url || process.env.REDIS_URL || 'redis://localhost:6379';

    const options: RedisOptions = {
      connectTimeout: this.timeout,
      commandTimeout: this.timeout,
      retryStrategy: (times: number) => {
        if (this.isShuttingDown) {
          return null; // Stop retrying during shutdown
        }
        if (times > this.maxRetries) {
          this.logger.error(
            `Redis connection failed after ${this.maxRetries} retries`,
          );
          return null; // Stop retrying
        }
        const delay = Math.min(this.retryDelay * Math.pow(2, times - 1), 30000);
        this.logger.warn(
          `Redis connection retry ${times}/${this.maxRetries} in ${delay}ms`,
        );
        return delay;
      },
      maxRetriesPerRequest: this.maxRetries,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    try {
      this.client = new Redis(url, options);

      // Set up event listeners
      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
      });

      this.client.on('ready', () => {
        this.logger.log('Redis ready');
      });

      this.client.on('error', (error: Error) => {
        this.logger.error(`Redis error: ${error.message}`);
      });

      this.client.on('close', () => {
        if (!this.isShuttingDown) {
          this.logger.warn('Redis connection closed unexpectedly');
        }
      });

      this.client.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      // Wait for initial connection with timeout
      await this.ping();
      this.logger.log('Redis connection established');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to connect to Redis: ${err.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.logger.log('Disconnecting from Redis...');
      await this.client.quit();
      this.client = null;
      this.logger.log('Redis disconnected');
    }
  }

  /**
   * Get Redis client instance
   * @throws {Error} if client is not initialized
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  /**
   * Ping Redis with timeout
   */
  async ping(): Promise<string> {
    const client = this.getClient();
    return this.executeWithTimeout(client.ping(), this.timeout, 'PING');
  }

  /**
   * Set a value with timeout
   */
  async set(key: string, value: string, ttl?: number): Promise<string> {
    const client = this.getClient();
    const command = ttl
      ? client.set(key, value, 'EX', ttl)
      : client.set(key, value);
    return this.executeWithTimeout(command, this.timeout, `SET ${key}`);
  }

  /**
   * Get a value with timeout
   */
  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return this.executeWithTimeout(client.get(key), this.timeout, `GET ${key}`);
  }

  /**
   * Delete a key with timeout
   */
  async del(key: string): Promise<number> {
    const client = this.getClient();
    return this.executeWithTimeout(client.del(key), this.timeout, `DEL ${key}`);
  }

  /**
   * Set a value with expiration
   */
  async setex(key: string, seconds: number, value: string): Promise<string> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.setex(key, seconds, value),
      this.timeout,
      `SETEX ${key}`,
    );
  }

  /**
   * Get and delete a key atomically
   */
  async getdel(key: string): Promise<string | null> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.getdel(key),
      this.timeout,
      `GETDEL ${key}`,
    );
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.exists(key),
      this.timeout,
      `EXISTS ${key}`,
    );
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const client = this.getClient();
    return this.executeWithTimeout(client.ttl(key), this.timeout, `TTL ${key}`);
  }

  /**
   * Increment a key
   */
  async incr(key: string): Promise<number> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.incr(key),
      this.timeout,
      `INCR ${key}`,
    );
  }

  /**
   * Increment by value
   */
  async incrby(key: string, increment: number): Promise<number> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.incrby(key, increment),
      this.timeout,
      `INCRBY ${key}`,
    );
  }

  /**
   * Execute a Redis command with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    commandName: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Redis command "${commandName}" timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Redis command failed: ${commandName} - ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Flush all keys (use with caution)
   */
  async flushall(): Promise<string> {
    const client = this.getClient();
    return this.executeWithTimeout(client.flushall(), this.timeout, 'FLUSHALL');
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.keys(pattern),
      this.timeout,
      `KEYS ${pattern}`,
    );
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs: Record<string, string>): Promise<string> {
    const client = this.getClient();
    const args = Object.entries(keyValuePairs).flat();
    return this.executeWithTimeout(client.mset(args), this.timeout, 'MSET');
  }

  /**
   * Get multiple keys at once
   */
  async mget(...keys: string[]): Promise<(string | null)[]> {
    const client = this.getClient();
    return this.executeWithTimeout(
      client.mget(keys),
      this.timeout,
      `MGET ${keys.join(',')}`,
    );
  }
}
