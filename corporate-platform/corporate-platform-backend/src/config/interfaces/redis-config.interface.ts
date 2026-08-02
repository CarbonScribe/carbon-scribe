export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  url: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  idleTimeout: number;
}
