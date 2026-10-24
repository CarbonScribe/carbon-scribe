import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '../config.service';
import { PlaceholderDetector } from './placeholder-detector';
import { ServiceValidator } from './service-validator';
import {
  StartupValidationResult,
  ServiceConnectivityResult,
} from './validation.types';

/**
 * Strict CORS origin format check (#646): an allowlisted origin must be an
 * http(s) URL with nothing beyond scheme + host[:port] — no path, query
 * string, fragment, or trailing slash, and no wildcard. `new URL(origin)`
 * rejects a missing scheme or a bare wildcard outright; comparing against
 * `.origin` (which never carries a trailing slash or path) catches the
 * rest, since an origin like `https://example.com/` would parse but its
 * `.origin` would be the un-slashed `https://example.com`.
 */
export function isValidCorsOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === origin
    );
  } catch {
    return false;
  }
}

/**
 * Validates a Soroban contract address (#647): a StrKey-encoded "C..."
 * address, 56 characters, with a valid internal checksum.
 * StrKey.isValidContract already enforces all of that — this just names
 * the check at the call site.
 */
export function isValidContractId(contractId: string): boolean {
  return StellarSdk.StrKey.isValidContract(contractId);
}

const KNOWN_MAINNET_HOSTS = new Set([
  'horizon.stellar.org',
  'soroban-rpc.mainnet.stellar.org',
]);

/**
 * Best-effort signal for which Stellar network a Horizon/Soroban RPC URL
 * points at, read from its hostname (#647). Returns null when the
 * hostname gives no clear signal (e.g. a third-party RPC provider's own
 * domain) — an ambiguous URL is never flagged, so a legitimate custom
 * endpoint can't trip a false-positive startup failure.
 */
export function detectNetworkFromUrl(url: string): 'testnet' | 'public' | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    hostname = url.toLowerCase();
  }

  if (hostname.includes('testnet')) {
    return 'testnet';
  }
  if (
    hostname.includes('mainnet') ||
    hostname.includes('public') ||
    KNOWN_MAINNET_HOSTS.has(hostname)
  ) {
    return 'public';
  }
  return null;
}

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

    // STELLAR_NETWORK vs. HORIZON_URL/SOROBAN_RPC_URL consistency (#647):
    // an operator could set STELLAR_NETWORK=public while a URL still
    // points at a testnet endpoint (or vice versa) — both prior checks
    // above pass (each var is independently "present"), but SorobanService
    // derives networkPassphrase from stellarConfig.network alone, so a
    // mismatch here means the passphrase and RPC endpoint silently
    // disagree about which network they're talking to.
    // Mirrors the production check just above, which only ever treats the
    // literal value 'testnet' as non-production — anything else (mainnet,
    // public, ...) is expected to point at production endpoints.
    const expectedNetwork =
      stellarConfig.network === 'testnet' ? 'testnet' : 'public';
    const networkCheckedUrls: Array<[string, string | undefined]> = [
      ['HORIZON_URL', stellarConfig.horizonUrl],
      ['SOROBAN_RPC_URL', stellarConfig.sorobanRpcUrl],
    ];
    for (const [varName, url] of networkCheckedUrls) {
      if (!url) {
        continue;
      }
      const detected = detectNetworkFromUrl(url);
      if (detected && detected !== expectedNetwork) {
        const message = `${varName} ("${url}") looks like a ${detected} endpoint, but STELLAR_NETWORK is "${stellarConfig.network}" — they must point at the same network`;
        if (isProduction) {
          errors.push(message);
        } else {
          warnings.push(message);
        }
      }
    }

    // === CONTRACT ADDRESSES ===
    // carbon-asset/retirement-tracker/methodology-library services each
    // fall back to a hardcoded contract address when their env var is
    // unset (see contract.interface.ts and methodology-library.service.ts)
    // — convenient for local development, but a production deploy that
    // forgets to set one would silently target the wrong deployed
    // contract rather than failing to boot.
    const contractIdEnvVars: Array<[string, string | undefined]> = [
      ['CARBON_ASSET_CONTRACT_ID', process.env.CARBON_ASSET_CONTRACT_ID],
      [
        'RETIREMENT_TRACKER_CONTRACT_ID',
        process.env.RETIREMENT_TRACKER_CONTRACT_ID,
      ],
      [
        'METHODOLOGY_LIBRARY_CONTRACT_ID',
        process.env.METHODOLOGY_LIBRARY_CONTRACT_ID,
      ],
    ];

    for (const [varName, value] of contractIdEnvVars) {
      if (!value) {
        if (isProduction) {
          errors.push(
            `${varName} must be explicitly configured in production (refusing to fall back to the hardcoded default contract address)`,
          );
        } else {
          warnings.push(
            `${varName} not configured (using the hardcoded fallback contract address)`,
          );
        }
        continue;
      }

      // Checked regardless of environment, like CORS_ORIGINS' format
      // check above — a typo'd contract address should fail loudly in
      // development too, not just silently never match any deployed
      // contract.
      if (!isValidContractId(value)) {
        errors.push(
          `${varName} is not a valid Stellar contract address: "${value}" (expected a StrKey-encoded "C..." address)`,
        );
      }
    }

    // Logged once at boot regardless of outcome, so the effective
    // configuration is always visible for operational verification
    // (#647) even when every check above passed silently.
    this.logger.log(
      `🪐 Stellar config: network=${stellarConfig.network}, horizonUrl=${stellarConfig.horizonUrl ?? '(unset)'}, sorobanRpcUrl=${stellarConfig.sorobanRpcUrl ?? '(unset)'}, ` +
        `carbonAssetContractId=${process.env.CARBON_ASSET_CONTRACT_ID ?? '(unset, using fallback)'}, ` +
        `retirementTrackerContractId=${process.env.RETIREMENT_TRACKER_CONTRACT_ID ?? '(unset, using fallback)'}, ` +
        `methodologyLibraryContractId=${process.env.METHODOLOGY_LIBRARY_CONTRACT_ID ?? '(unset, using fallback)'}`,
    );

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
    const corsOriginList = (corsOrigins ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (isProduction && corsOriginList.length === 0) {
      // Production must never silently fall back to parseCorsOrigins'
      // localhost defaults (main.ts) — that default exists purely for
      // development convenience.
      errors.push(
        'CORS_ORIGINS must be explicitly configured in production (refusing to fall back to the default localhost origins)',
      );
    }

    // Format is checked whenever an origin is actually configured,
    // regardless of environment — a typo'd entry should fail loudly in
    // development too, not just silently never match any real request.
    for (const origin of corsOriginList) {
      if (!isValidCorsOrigin(origin)) {
        errors.push(
          `CORS_ORIGINS contains an invalid origin: "${origin}" (must be an http(s) URL with no path, query string, trailing slash, or wildcard)`,
        );
      }
    }
  }
}
