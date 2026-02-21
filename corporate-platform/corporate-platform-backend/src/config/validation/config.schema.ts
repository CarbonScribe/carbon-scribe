import * as Joi from 'joi';

export const configSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  SERVICE_NAME: Joi.string().default('corporate-platform-backend'),
  DATABASE_URL: Joi.string().uri().optional(),
  DB_POOL_SIZE: Joi.number().integer().min(1).default(10),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().integer().min(1).default(6379),
  REDIS_PASSWORD: Joi.string().allow('', null),
  KAFKA_BROKERS: Joi.string().allow(''),
  KAFKA_CLIENT_ID: Joi.string().default('corporate-platform-backend'),
  STELLAR_NETWORK: Joi.string().default('testnet'),
  HORIZON_URL: Joi.string().uri().allow(''),
  JWT_SECRET: Joi.string().default('dev-jwt-secret'),
  JWT_EXPIRY: Joi.string().default('15m'),
  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error', 'fatal')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'pretty').default('json'),
  LOG_ENABLE_CONSOLE: Joi.boolean().default(true),
  LOG_ENABLE_FILE: Joi.boolean().default(false),
  LOG_ENABLE_ELASTIC: Joi.boolean().default(false),
  LOG_ENABLE_KAFKA: Joi.boolean().default(false),
  LOG_DIRECTORY: Joi.string().default('logs'),
  SATELLITE_API_KEY: Joi.string().allow(''),
  IPFS_GATEWAY: Joi.string().uri().allow(''),
  CONFIG_FILE: Joi.string().allow(''),
  CONFIG_WATCH_FILE: Joi.string().allow(''),
});
