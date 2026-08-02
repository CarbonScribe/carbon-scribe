import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { configSchema } from './validation/config.schema';
import { AppConfig } from './interfaces/app-config.interface';
import { DatabaseConfig } from './interfaces/database-config.interface';
import { RedisConfig } from './interfaces/redis-config.interface';
import { KafkaConfig } from './interfaces/kafka-config.interface';
import { StellarConfig } from './interfaces/stellar-config.interface';
import { AuthConfig } from './interfaces/auth-config.interface';
import {
  LogFormat,
  LogLevel,
  LoggingConfig,
} from './interfaces/logging-config.interface';
import { ServicesConfig } from './interfaces/services-config.interface';
import { TimeoutConfig } from './interfaces/timeout-config.interface';
import { CircuitBreakerConfig } from './interfaces/circuit-breaker-config.interface';

export interface RateLimitConfig {
  enabled: boolean;
  defaultWindowMs: number;
  defaultMaxRequests: number;
  redisKeyPrefix: string;
  enableMetrics: boolean;
  enableLogging: boolean;
  whitelistEnabled: boolean;
}

export interface AllConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  kafka: KafkaConfig;
  stellar: StellarConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  services: ServicesConfig;
  rateLimit: RateLimitConfig;
}

@Injectable()
export class ConfigService {
  private config: AllConfig;

  constructor() {
    this.loadEnvFile();
    this.config = this.buildConfig();
  }

  reload(): void {
    this.loadEnvFile();
    this.config = this.buildConfig();
  }

  getAppConfig(): AppConfig {
    return this.config.app;
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  getRedisConfig(): RedisConfig {
    return this.config.redis;
  }

  getKafkaConfig(): KafkaConfig {
    return this.config.kafka;
  }

  getStellarConfig(): StellarConfig {
    return this.config.stellar;
  }

  getAuthConfig(): AuthConfig {
    return this.config.auth;
  }

  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  getServicesConfig(): ServicesConfig {
    return this.config.services;
  }

  getRateLimitConfig(): RateLimitConfig {
    return this.config.rateLimit;
  }

  /**
   * Get timeout configuration
   */
  getTimeoutConfig(): TimeoutConfig {
    return {
      defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
      shutdownGracePeriod: parseInt(
        process.env.SHUTDOWN_GRACE_PERIOD || '30000',
        10,
      ),
      healthCheckTimeout: parseInt(
        process.env.HEALTH_CHECK_TIMEOUT || '5000',
        10,
      ),
    };
  }

  /**
   * Get circuit breaker configuration
   */
  getCircuitBreakerConfig(): CircuitBreakerConfig {
    return {
      enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
      failureThreshold: parseInt(
        process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5',
        10,
      ),
      successThreshold: parseInt(
        process.env.CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '2',
        10,
      ),
      timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '30000', 10),
      resetTimeout: parseInt(
        process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '60000',
        10,
      ),
    };
  }

  private loadEnvFile(): void {
    const explicitPath = process.env.CONFIG_FILE;
    if (explicitPath && existsSync(explicitPath)) {
      dotenv.config({ path: explicitPath });
      return;
    }
    const defaultPath = resolve(process.cwd(), '.env');
    if (existsSync(defaultPath)) {
      dotenv.config({ path: defaultPath });
      return;
    }
    dotenv.config();
  }

  private buildConfig(): AllConfig {
    const { value, error } = configSchema.validate(process.env, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }

    const app: AppConfig = {
      nodeEnv: value.NODE_ENV,
      port: value.PORT,
      apiPrefix: value.API_PREFIX,
      serviceName: value.SERVICE_NAME,
    };

    // Basic production validation (additional validation handled by StartupValidator)
    if (app.nodeEnv === 'production') {
      if (!value.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in production');
      }
      if (!value.JWT_SECRET || value.JWT_SECRET === 'dev-jwt-secret') {
        throw new Error(
          'JWT_SECRET must be set to a secure value in production',
        );
      }
    }

    const database: DatabaseConfig = {
      url: value.DATABASE_URL,
      poolSize: value.DB_POOL_SIZE,
    };

    const redis: RedisConfig = {
      host: value.REDIS_HOST,
      port: value.REDIS_PORT,
      password: value.REDIS_PASSWORD || undefined,
      // Timeout properties with defaults
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      timeout: parseInt(process.env.REDIS_TIMEOUT || '5000', 10),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
      connectionTimeout: parseInt(
        process.env.REDIS_CONNECTION_TIMEOUT || '5000',
        10,
      ),
      idleTimeout: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000', 10),
    };

    const kafka: KafkaConfig = {
      brokers: (value.KAFKA_BROKERS || '')
        .split(',')
        .map((b: string) => b.trim())
        .filter(Boolean),
      clientId: value.KAFKA_CLIENT_ID,
      ssl: value.KAFKA_SSL_ENABLED,
      sasl:
        value.KAFKA_SASL_MECHANISM && value.KAFKA_SASL_USERNAME
          ? {
              mechanism: value.KAFKA_SASL_MECHANISM,
              username: value.KAFKA_SASL_USERNAME,
              password: value.KAFKA_SASL_PASSWORD,
            }
          : undefined,
      retry: {
        initialRetryTime: value.KAFKA_RETRY_INITIAL,
        retries: value.KAFKA_RETRY_MAX,
      },
      // Timeout properties with defaults
      groupId: process.env.KAFKA_GROUP_ID || 'corporate-platform-backend-group',
      producerTimeout: parseInt(
        process.env.KAFKA_PRODUCER_TIMEOUT || '10000',
        10,
      ),
      consumerTimeout: parseInt(
        process.env.KAFKA_CONSUMER_TIMEOUT || '30000',
        10,
      ),
      maxRetries: parseInt(process.env.KAFKA_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.KAFKA_RETRY_DELAY || '1000', 10),
      connectionTimeout: parseInt(
        process.env.KAFKA_CONNECTION_TIMEOUT || '5000',
        10,
      ),
    };

    const stellar: StellarConfig = {
      network: value.STELLAR_NETWORK,
      horizonUrl: value.HORIZON_URL || undefined,
      sorobanRpcUrl: value.SOROBAN_RPC_URL || undefined,
      // Timeout properties with defaults
      simulateTimeout: parseInt(
        process.env.STELLAR_SIMULATE_TIMEOUT || '30000',
        10,
      ),
      sendTimeout: parseInt(process.env.STELLAR_SEND_TIMEOUT || '60000', 10),
      getTransactionTimeout: parseInt(
        process.env.STELLAR_GET_TX_TIMEOUT || '10000',
        10,
      ),
      getEventsTimeout: parseInt(
        process.env.STELLAR_GET_EVENTS_TIMEOUT || '15000',
        10,
      ),
      getLatestLedgerTimeout: parseInt(
        process.env.STELLAR_GET_LEDGER_TIMEOUT || '10000',
        10,
      ),
    };

    const auth: AuthConfig = {
      jwtSecret: value.JWT_SECRET,
      jwtExpiry: value.JWT_EXPIRY,
    };

    const logging: LoggingConfig = {
      level: value.LOG_LEVEL as LogLevel,
      format: value.LOG_FORMAT as LogFormat,
      enableConsole: value.LOG_ENABLE_CONSOLE,
      enableFile: value.LOG_ENABLE_FILE,
      enableElastic: value.LOG_ENABLE_ELASTIC,
      enableKafka: value.LOG_ENABLE_KAFKA,
      logDirectory: value.LOG_DIRECTORY,
    };

    const services: ServicesConfig = {
      satelliteApiKey: value.SATELLITE_API_KEY || undefined,
      ipfsGateway: value.IPFS_GATEWAY || undefined,
    };

    // Rate limit configuration with environment variable overrides
    const rateLimit: RateLimitConfig = {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      defaultWindowMs: parseInt(
        process.env.RATE_LIMIT_DEFAULT_WINDOW_MS || '60000',
        10,
      ),
      defaultMaxRequests: parseInt(
        process.env.RATE_LIMIT_DEFAULT_MAX_REQUESTS || '10',
        10,
      ),
      redisKeyPrefix: process.env.RATE_LIMIT_REDIS_PREFIX || 'rate-limit',
      enableMetrics: process.env.RATE_LIMIT_METRICS_ENABLED !== 'false',
      enableLogging: process.env.RATE_LIMIT_LOGGING_ENABLED !== 'false',
      whitelistEnabled: process.env.RATE_LIMIT_WHITELIST_ENABLED !== 'false',
    };

    return {
      app,
      database,
      redis,
      kafka,
      stellar,
      auth,
      logging,
      services,
      rateLimit,
    };
  }
}
