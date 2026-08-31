import * as Joi from 'joi';

export const configSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  SERVICE_NAME: Joi.string().default('corporate-platform-backend'),

  // ============================================================
  // Database Configuration
  // ============================================================
  DATABASE_URL: Joi.string().uri().optional(),
  DB_POOL_SIZE: Joi.number().integer().min(1).default(10),

  // ============================================================
  // Redis Configuration
  // ============================================================
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().integer().min(1).default(6379),
  REDIS_PASSWORD: Joi.string().allow('', null),

  // ============================================================
  // Kafka Configuration
  // ============================================================
  KAFKA_BROKERS: Joi.string().allow(''),
  KAFKA_CLIENT_ID: Joi.string().default('corporate-platform-backend'),
  KAFKA_SSL_ENABLED: Joi.boolean().default(false),
  KAFKA_SASL_MECHANISM: Joi.string()
    .valid('plain', 'scram-sha-256', 'scram-sha-512', 'oauthbearer')
    .allow(''),
  KAFKA_SASL_USERNAME: Joi.string().allow(''),
  KAFKA_SASL_PASSWORD: Joi.string().allow(''),
  KAFKA_RETRY_INITIAL: Joi.number().integer().min(100).default(300),
  KAFKA_RETRY_MAX: Joi.number().integer().min(0).default(5),

  // ============================================================
  // Stellar/Soroban Configuration
  // ============================================================
  STELLAR_NETWORK: Joi.string().default('testnet'),
  HORIZON_URL: Joi.string().uri().allow(''),
  SOROBAN_RPC_URL: Joi.string().uri().allow(''),
  // Signing (#542): explicit mode — never treat missing secret as silent simulate
  STELLAR_SIGNING_MODE: Joi.string().valid('simulate', 'live').default('simulate'),
  STELLAR_SIGNING_PROVIDER: Joi.string().valid('env', 'kms', 'vault').default('env'),
  STELLAR_SECRET_KEY: Joi.string().allow('', null),
  STELLAR_TRANSFER_SECRET_KEY: Joi.string().allow('', null),
  STELLAR_KMS_KEY_ID: Joi.string().allow('', null),
  STELLAR_KMS_PUBLIC_KEY: Joi.string().allow('', null),
  STELLAR_VAULT_KEY_PATH: Joi.string().allow('', null),

  // ============================================================
  // Auth Configuration
  // ============================================================
  JWT_SECRET: Joi.string().default('dev-jwt-secret'),
  JWT_EXPIRY: Joi.string().default('15m'),

  // ============================================================
  // Logging Configuration
  // ============================================================
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),
  LOG_ENABLE_CONSOLE: Joi.boolean().default(true),
  LOG_ENABLE_FILE: Joi.boolean().default(false),
  LOG_ENABLE_ELASTIC: Joi.boolean().default(false),
  LOG_ENABLE_KAFKA: Joi.boolean().default(false),
  LOG_DIRECTORY: Joi.string().default('logs'),

  // ============================================================
  // Services Configuration
  // ============================================================
  SATELLITE_API_KEY: Joi.string().allow(''),
  IPFS_GATEWAY: Joi.string().uri().allow(''),

  // ============================================================
  // Config File Override
  // ============================================================
  CONFIG_FILE: Joi.string().allow(''),
  CONFIG_WATCH_FILE: Joi.string().allow(''),

  // ============================================================
  // Pinata IPFS Configuration
  // ============================================================
  // NOTE: These are required in production. Schema allows them to be optional
  // but StartupValidator will enforce production requirements.
  PINATA_API_KEY: Joi.string().allow('').optional(),
  PINATA_SECRET_KEY: Joi.string().allow('').optional(),
  PINATA_JWT: Joi.string().allow('').optional(),
  PINATA_GATEWAY: Joi.string()
    .uri()
    .default('https://gateway.pinata.cloud/ipfs/'),
  PINATA_TIMEOUT_MS: Joi.number().integer().min(1000).default(20000),

  // Pinata upload retry tuning
  PINATA_RETRY_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  PINATA_RETRY_INITIAL_DELAY_MS: Joi.number().integer().min(0).default(1000),
  PINATA_RETRY_MAX_DELAY_MS: Joi.number().integer().min(1).default(30000),
  PINATA_RETRY_BACKOFF_MULTIPLIER: Joi.number().min(1).default(2),

  // ============================================================
  // Startup Validation Configuration
  // ============================================================
  STARTUP_VALIDATE_SERVICES: Joi.boolean().default(false),

  // ============================================================
  // CORS Configuration
  // ============================================================
  CORS_ORIGINS: Joi.string().allow(''),
});
