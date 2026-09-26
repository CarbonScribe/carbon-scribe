import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config.service';
import { PlaceholderDetector } from './placeholder-detector';
import { ServiceValidator } from './service-validator';
import {
  StartupValidationResult,
  ServiceConnectivityResult,
} from './validation.types';

@Injectable()
export class StartupValidator implements OnModuleInit {
  private readonly logger = new Logger(StartupValidator.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly serviceValidator: ServiceValidator,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.validateStartup();
  }

  /**
   * Validates all configuration and service connectivity at startup
   */
  async validateStartup(): Promise<StartupValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const isProduction =
      this.configService.getAppConfig().nodeEnv === 'production';

    this.logger.log(
      `🔍 Running startup validation in ${isProduction ? 'production' : 'development'} mode`,
    );

    // 1. Validate configuration
    this.validateConfiguration(errors, warnings);

    // 2. Validate service connectivity (only in production or when explicitly enabled)
    const connectivityChecks: Array<
      'database' | 'redis' | 'kafka' | 'stellar' | 'ipfs'
    > = [];

    if (isProduction) {
      connectivityChecks.push('database', 'redis', 'kafka', 'stellar', 'ipfs');
    } else if (process.env.STARTUP_VALIDATE_SERVICES === 'true') {
      connectivityChecks.push('database', 'redis', 'kafka', 'stellar', 'ipfs');
    } else {
      this.logger.log(
        '⏭️ Skipping service connectivity checks in development (set STARTUP_VALIDATE_SERVICES=true to enable)',
      );
    }

    let connectivityResults: ServiceConnectivityResult[] = [];
    if (connectivityChecks.length > 0) {
      this.logger.log(
        `🔗 Validating service connectivity for: ${connectivityChecks.join(', ')}`,
      );
      connectivityResults =
        await this.serviceValidator.validateAllServices(connectivityChecks);

      for (const result of connectivityResults) {
        if (!result.connected) {
          if (isProduction) {
            errors.push(
              `Service ${result.service} is not reachable: ${result.error || 'Unknown error'}`,
            );
          } else {
            warnings.push(
              `Service ${result.service} is not reachable: ${result.error || 'Unknown error'}`,
            );
          }
        } else {
          this.logger.log(
            `✅ ${result.service} connected (${result.latencyMs}ms)`,
          );
        }
      }
    }

    const valid = errors.length === 0;

    if (valid) {
      this.logger.log('✅ All startup validations passed');
    } else {
      this.logger.error(
        `❌ Startup validation failed with ${errors.length} errors`,
      );
      for (const error of errors) {
        this.logger.error(`  - ${error}`);
      }
    }

    if (warnings.length > 0) {
      for (const warning of warnings) {
        this.logger.warn(`⚠️  ${warning}`);
      }
    }

    const result: StartupValidationResult = {
      valid,
      errors,
      warnings,
      connectivity: connectivityResults,
    };

    return result;
  }

  /**
   * Validates configuration values
   */
  private validateConfiguration(errors: string[], warnings: string[]): void {
    const isProduction =
      this.configService.getAppConfig().nodeEnv === 'production';
    const databaseConfig = this.configService.getDatabaseConfig();
    const redisConfig = this.configService.getRedisConfig();
    const kafkaConfig = this.configService.getKafkaConfig();
    const stellarConfig = this.configService.getStellarConfig();
    const authConfig = this.configService.getAuthConfig();
    const servicesConfig = this.configService.getServicesConfig();

    const placeholderDetector = new PlaceholderDetector();

    // === DATABASE ===
    if (!databaseConfig.url) {
      errors.push('DATABASE_URL is required');
    } else if (
      isProduction &&
      placeholderDetector.isPlaceholder(databaseConfig.url)
    ) {
      errors.push('DATABASE_URL appears to be a placeholder value');
    }

    // === JWT SECRET ===
    if (!authConfig.jwtSecret) {
      errors.push('JWT_SECRET is required');
    } else if (isProduction) {
      const validation = placeholderDetector.validateValue(
        authConfig.jwtSecret,
        'JWT_SECRET',
        { minLength: 32, requiredSpecialChars: true },
      );
      if (!validation.isValid) {
        errors.push(`JWT_SECRET validation failed: ${validation.message}`);
      }
    }

    // === KAFKA ===
    if (isProduction) {
      if (!kafkaConfig.brokers || kafkaConfig.brokers.length === 0) {
        errors.push('KAFKA_BROKERS must be configured in production');
      } else {
        const hasValidBroker = kafkaConfig.brokers.some(
          (broker: string) => broker && broker.trim().length > 0,
        );
        if (!hasValidBroker) {
          errors.push('KAFKA_BROKERS contains invalid or empty values');
        }
      }
    } else {
      if (!kafkaConfig.brokers || kafkaConfig.brokers.length === 0) {
        warnings.push('KAFKA_BROKERS not configured (skipping in development)');
      }
    }

    // === REDIS ===
    if (isProduction) {
      if (!redisConfig.host) {
        errors.push('REDIS_HOST must be configured in production');
      }
      if (!redisConfig.port) {
        errors.push('REDIS_PORT must be configured in production');
      }
    } else {
      if (!redisConfig.host) {
        warnings.push('REDIS_HOST not configured (skipping in development)');
      }
    }

    // === STELLAR ===
    if (isProduction) {
      if (!stellarConfig.network || stellarConfig.network === 'testnet') {
        errors.push(
          'STELLAR_NETWORK must be configured to a production network (mainnet) in production',
        );
      }
      if (!stellarConfig.horizonUrl) {
        errors.push('HORIZON_URL must be configured in production');
      }
      if (!stellarConfig.sorobanRpcUrl) {
        errors.push('SOROBAN_RPC_URL must be configured in production');
      }
    } else {
      if (!stellarConfig.horizonUrl) {
        warnings.push('HORIZON_URL not configured (skipping in development)');
      }
      if (!stellarConfig.sorobanRpcUrl) {
        warnings.push(
          'SOROBAN_RPC_URL not configured (skipping in development)',
        );
      }
    }

    // === PINATA/IPFS ===
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_KEY;
    const pinataJwt = process.env.PINATA_JWT;

    if (isProduction) {
      if (!pinataApiKey) {
        errors.push('PINATA_API_KEY is required in production');
      } else if (placeholderDetector.isPlaceholder(pinataApiKey)) {
        errors.push('PINATA_API_KEY appears to be a placeholder value');
      }

      if (!pinataSecretKey) {
        errors.push('PINATA_SECRET_KEY is required in production');
      } else if (placeholderDetector.isPlaceholder(pinataSecretKey)) {
        errors.push('PINATA_SECRET_KEY appears to be a placeholder value');
      }

      if (!pinataJwt) {
        errors.push('PINATA_JWT is required in production');
      } else if (placeholderDetector.isPlaceholder(pinataJwt)) {
        errors.push('PINATA_JWT appears to be a placeholder value');
      }
    } else {
      if (!pinataApiKey || placeholderDetector.isPlaceholder(pinataApiKey)) {
        warnings.push(
          'PINATA_API_KEY is missing or placeholder (IPFS features will be limited)',
        );
      }
      if (
        !pinataSecretKey ||
        placeholderDetector.isPlaceholder(pinataSecretKey)
      ) {
        warnings.push(
          'PINATA_SECRET_KEY is missing or placeholder (IPFS features will be limited)',
        );
      }
      if (!pinataJwt || placeholderDetector.isPlaceholder(pinataJwt)) {
        warnings.push(
          'PINATA_JWT is missing or placeholder (IPFS features will be limited)',
        );
      }
    }

    // === IPFS Gateway ===
    if (isProduction) {
      if (!servicesConfig.ipfsGateway) {
        warnings.push(
          'IPFS_GATEWAY not configured (using default Pinata gateway)',
        );
      }
    }

    // === CORS Origins ===
    const corsOrigins = process.env.CORS_ORIGINS;
    if (isProduction) {
      if (!corsOrigins) {
        warnings.push(
          'CORS_ORIGINS not configured (using default localhost origins)',
        );
      } else {
        const origins = corsOrigins
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        if (origins.length === 0) {
          warnings.push('CORS_ORIGINS configured but empty');
        }
      }
    }
  }
}
