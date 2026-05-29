import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { KafkaService } from '../event-bus/kafka.service';
import { IpfsConfig } from '../ipfs/ipfs.config';
import { SorobanService } from '../stellar/soroban/soroban.service';
import axios from 'axios';

export interface HealthCheckDetail {
  status: 'healthy' | 'unhealthy' | 'disabled';
  latencyMs?: number;
  error?: string;
  details?: string;
}

export interface ReadinessResponse {
  status: 'healthy' | 'unhealthy';
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database check timed out')), 2000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error('Database health check failed', err.stack);
      return { status: 'unhealthy', error: err.message };
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out')), 2000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error('Redis health check failed', err.stack);
      return { status: 'unhealthy', error: err.message };
    }
  }

  /**
   * Performs a Kafka broker check using topic metadata fetch with a 3-second timeout.
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Kafka metadata fetch timed out')), 3000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error('Kafka health check failed', err.stack);
      return { status: 'unhealthy', error: err.message };
    }
  }

  /**
   * Performs an IPFS/Pinata gateway reachability check with a 2-second timeout.
   * If mock credentials are used, we accept 401/403 as reachable, indicating network up.
   */
  async checkIpfs(): Promise<HealthCheckDetail> {
    const start = Date.now();
    try {
      const headers = this.ipfsConfig.jwt
        ? { Authorization: `Bearer ${this.ipfsConfig.jwt}` }
        : {};
      
      const requestPromise = axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers,
        timeout: 2000,
      });

      await Promise.race([
        requestPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('IPFS gateway reachability check timed out')), 2000),
        ),
      ]);

      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      // If we get an HTTP response back, the endpoint is reachable (network connectivity is up)
      if (err.response) {
        return {
          status: 'healthy',
          latencyMs: Date.now() - start,
          details: `Reachable (HTTP Status: ${err.response.status})`,
        };
      }
      this.logger.error('IPFS reachability check failed', err.stack);
      return { status: 'unhealthy', error: err.message };
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
        return { status: 'unhealthy', error: 'Stellar RPC client not initialized' };
      }
      await Promise.race([
        rpcClient.getLatestLedger(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stellar RPC request timed out')), 2000),
        ),
      ]);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error('Stellar health check failed', err.stack);
      return { status: 'unhealthy', error: err.message };
    }
  }

  /**
   * Runs all critical dependency health checks in parallel to avoid blocking.
   * Total time complexity: O(max(timeout)) = O(1) time-bounded execution.
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

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
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
