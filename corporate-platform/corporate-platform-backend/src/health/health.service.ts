import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { RedisService } from '../shared/cache/redis.service';
import { KafkaService } from '../event-bus/kafka.service';
import { IpfsConfig } from '../ipfs/ipfs.config';
import { SorobanService } from '../stellar/soroban/soroban.service';
import axios from 'axios';

export interface HealthCheckDetail {
  status: 'healthy' | 'unhealthy' | 'disabled' | 'warning';
  latencyMs?: number;
  error?: string;
  details?: string;
}

export interface ReadinessResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptimeSeconds: number;
  checks: {
    database: HealthCheckDetail;
    redis: HealthCheckDetail;
    kafka: HealthCheckDetail;
    ipfs: HealthCheckDetail;
    stellar: HealthCheckDetail;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private readonly healthCheckTimeout = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
    private readonly ipfsConfig: IpfsConfig,
    private readonly sorobanService: SorobanService,
  ) {}

  /**
   * Performs a database connectivity check with a 2-second timeout.
   */
  async checkDatabase(): Promise<HealthCheckDetail> {
    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database check timed out')), 2000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Database health check failed', error.stack);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Performs a Redis connectivity check using PING with a 2-second timeout.
   */
  async checkRedis(): Promise<HealthCheckDetail> {
    const start = Date.now();
    try {
      const client = this.redisService.getClient();
      if (!client) {
        return { status: 'unhealthy', error: 'Redis client not initialized' };
      }
      await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out')), 2000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Redis health check failed', error.stack);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Performs a Kafka broker check with a 3-second timeout.
   */
  async checkKafka(): Promise<HealthCheckDetail> {
    if (!this.kafkaService.isEnabled()) {
      return { status: 'disabled', details: 'Kafka service is disabled' };
    }
    const start = Date.now();
    try {
      const admin = this.kafkaService.getAdmin();
      await Promise.race([
        admin.fetchTopicMetadata({ topics: [] }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Kafka metadata fetch timed out')),
            3000,
          ),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      const error = err as Error;
      this.logger.error('Kafka health check failed', error.stack);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Performs an IPFS/Pinata gateway reachability check with a 2-second timeout.
   */
  async checkIpfs(): Promise<HealthCheckDetail> {
    const start = Date.now();
    try {
      const headers = this.ipfsConfig.jwt
        ? { Authorization: `Bearer ${this.ipfsConfig.jwt}` }
        : {};

      const requestPromise = axios.get(
        'https://api.pinata.cloud/data/testAuthentication',
        {
          headers,
          timeout: 2000,
        },
      );

      await Promise.race([
        requestPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error('IPFS gateway reachability check timed out')),
            2000,
          ),
        ),
      ]);

      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      const error = err as any;
      // If we get an HTTP response back, the endpoint is reachable
      if (error.response) {
        return {
          status: 'healthy',
          latencyMs: Date.now() - start,
          details: `Reachable (HTTP Status: ${error.response.status})`,
        };
      }
      this.logger.error('IPFS reachability check failed', error.stack);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Performs a Stellar RPC/Soroban server network call with a 2-second timeout.
   */
  async checkStellar(): Promise<HealthCheckDetail> {
    const start = Date.now();
    try {
      const rpcClient = this.sorobanService.getRpcClient();
      if (!rpcClient) {
        return {
          status: 'unhealthy',
          error: 'Stellar RPC client not initialized',
        };
      }

      // Create an abort controller for the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        await Promise.race([
          rpcClient.getLatestLedger(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Stellar RPC request timed out')),
              2000,
            ),
          ),
        ]);
        clearTimeout(timeoutId);
        return { status: 'healthy', latencyMs: Date.now() - start };
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error('Stellar health check failed', error.stack);
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Runs all critical dependency health checks in parallel
   */
  async getReadiness(): Promise<ReadinessResponse> {
    const [dbResult, redisResult, kafkaResult, ipfsResult, stellarResult] =
      await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkKafka(),
        this.checkIpfs(),
        this.checkStellar(),
      ]);

    const isHealthy =
      dbResult.status === 'healthy' &&
      redisResult.status === 'healthy' &&
      (kafkaResult.status === 'healthy' || kafkaResult.status === 'disabled') &&
      ipfsResult.status === 'healthy' &&
      stellarResult.status === 'healthy';

    const isDegraded = !isHealthy && dbResult.status === 'healthy';

    const status = isHealthy
      ? 'healthy'
      : isDegraded
        ? 'degraded'
        : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.1',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbResult,
        redis: redisResult,
        kafka: kafkaResult,
        ipfs: ipfsResult,
        stellar: stellarResult,
      },
    };
  }
}
