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

export interface AllConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  kafka: KafkaConfig;
  stellar: StellarConfig;
  auth: AuthConfig;
  logging: LoggingConfig;
  services: ServicesConfig;
}

@Injectable()
export class ConfigService {
  private config: AllConfig;

  constructor() {
    this.loadEnvFile();
    this.config = this.buildConfig();
  }

  reload() {
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

  private loadEnvFile() {
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
    };

    const kafka: KafkaConfig = {
      brokers: (value.KAFKA_BROKERS || '')
        .split(',')
        .map((b: string) => b.trim())
        .filter(Boolean),
      clientId: value.KAFKA_CLIENT_ID,
    };

    const stellar: StellarConfig = {
      network: value.STELLAR_NETWORK,
      horizonUrl: value.HORIZON_URL || undefined,
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

    return {
      app,
      database,
      redis,
      kafka,
      stellar,
      auth,
      logging,
      services,
    };
  }
}
