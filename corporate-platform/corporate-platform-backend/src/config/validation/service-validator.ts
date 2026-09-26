import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { KafkaService } from '../../event-bus/kafka.service';
import { SorobanService } from '../../stellar/soroban/soroban.service';
import { IpfsConfig } from '../../ipfs/ipfs.config';
import axios from 'axios';
import { ServiceConnectivityResult } from './validation.types';

@Injectable()
export class ServiceValidator {
  private readonly logger = new Logger(ServiceValidator.name);

  constructor(
    private readonly prismaService?: PrismaService,
    private readonly redisService?: RedisService,
    private readonly kafkaService?: KafkaService,
    private readonly sorobanService?: SorobanService,
    private readonly ipfsConfig?: IpfsConfig,
  ) {}

  /**
   * Validates database connectivity
   */
  async validateDatabase(): Promise<ServiceConnectivityResult> {
    const start = Date.now();
    try {
      if (!this.prismaService) {
        return {
          service: 'Database',
          connected: false,
          error: 'PrismaService not available',
        };
      }

      await Promise.race([
        this.prismaService.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database check timed out')), 5000),
        ),
      ]);

      return {
        service: 'Database',
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Database connectivity check failed: ${err.message}`);
      return {
        service: 'Database',
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Validates Redis connectivity
   */
  async validateRedis(): Promise<ServiceConnectivityResult> {
    const start = Date.now();
    try {
      if (!this.redisService) {
        return {
          service: 'Redis',
          connected: false,
          error: 'RedisService not available',
        };
      }

      const client = this.redisService.getClient();
      if (!client) {
        return {
          service: 'Redis',
          connected: false,
          error: 'Redis client not initialized',
        };
      }

      await Promise.race([
        client.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out')), 5000),
        ),
      ]);

      return {
        service: 'Redis',
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Redis connectivity check failed: ${err.message}`);
      return {
        service: 'Redis',
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Validates Kafka connectivity
   */
  async validateKafka(): Promise<ServiceConnectivityResult> {
    const start = Date.now();
    try {
      if (!this.kafkaService) {
        return {
          service: 'Kafka',
          connected: false,
          error: 'KafkaService not available',
        };
      }

      if (!this.kafkaService.isEnabled()) {
        return {
          service: 'Kafka',
          connected: true,
          latencyMs: Date.now() - start,
          error: 'Kafka is disabled, skipping connectivity check',
        };
      }

      const admin = this.kafkaService.getAdmin();
      await Promise.race([
        admin.fetchTopicMetadata({ topics: [] }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Kafka metadata fetch timed out')),
            5000,
          ),
        ),
      ]);

      return {
        service: 'Kafka',
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Kafka connectivity check failed: ${err.message}`);
      return {
        service: 'Kafka',
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Validates Stellar/Soroban connectivity
   */
  async validateStellar(): Promise<ServiceConnectivityResult> {
    const start = Date.now();
    try {
      if (!this.sorobanService) {
        return {
          service: 'Stellar',
          connected: false,
          error: 'SorobanService not available',
        };
      }

      const rpcClient = this.sorobanService.getRpcClient();
      if (!rpcClient) {
        return {
          service: 'Stellar',
          connected: false,
          error: 'Stellar RPC client not initialized',
        };
      }

      await Promise.race([
        rpcClient.getLatestLedger(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Stellar RPC request timed out')),
            5000,
          ),
        ),
      ]);

      return {
        service: 'Stellar',
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Stellar connectivity check failed: ${err.message}`);
      return {
        service: 'Stellar',
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Validates IPFS/Pinata connectivity
   */
  async validateIpfs(): Promise<ServiceConnectivityResult> {
    const start = Date.now();
    try {
      if (!this.ipfsConfig) {
        return {
          service: 'IPFS',
          connected: false,
          error: 'IpfsConfig not available',
        };
      }

      const headers = this.ipfsConfig.jwt
        ? { Authorization: `Bearer ${this.ipfsConfig.jwt}` }
        : {};

      await Promise.race([
        axios.get('https://api.pinata.cloud/data/testAuthentication', {
          headers,
          timeout: 5000,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('IPFS connectivity check timed out')),
            5000,
          ),
        ),
      ]);

      return {
        service: 'IPFS',
        connected: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      const err = error as Error;
      // If we get an HTTP response, the endpoint is reachable
      if (err && (err as any).response) {
        return {
          service: 'IPFS',
          connected: true,
          latencyMs: Date.now() - start,
          error: `Reachable but authentication failed: ${(err as any).response.status}`,
        };
      }
      this.logger.error(`IPFS connectivity check failed: ${err.message}`);
      return {
        service: 'IPFS',
        connected: false,
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  /**
   * Runs all service connectivity checks
   */
  async validateAllServices(
    checks: Array<'database' | 'redis' | 'kafka' | 'stellar' | 'ipfs'>,
  ): Promise<ServiceConnectivityResult[]> {
    const results: ServiceConnectivityResult[] = [];
    const checkMap: Record<string, () => Promise<ServiceConnectivityResult>> = {
      database: () => this.validateDatabase(),
      redis: () => this.validateRedis(),
      kafka: () => this.validateKafka(),
      stellar: () => this.validateStellar(),
      ipfs: () => this.validateIpfs(),
    };

    const promises = checks
      .filter((check) => checkMap[check])
      .map((check) => checkMap[check]());

    const settledResults = await Promise.allSettled(promises);

    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          service: 'Unknown',
          connected: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    return results;
  }
}
