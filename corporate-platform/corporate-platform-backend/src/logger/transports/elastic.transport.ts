import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { formatStructured } from '../formatters/structured.formatter';

export interface ElasticTransportConfig {
  enabled?: boolean;
  url?: string;
  index?: string;
  username?: string;
  password?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  ssl?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

/**
 * Elasticsearch transport for sending structured logs to Elasticsearch.
 * Supports authentication, SSL, retries, and index rotation.
 */
export class ElasticTransport implements LogTransport {
  private readonly enabled: boolean;
  private readonly url: string;
  private readonly index: string;
  private readonly username?: string;
  private readonly password?: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly sslConfig?: ElasticTransportConfig['ssl'];
  private isHealthy = true;
  private lastError?: Date;

  constructor(config?: ElasticTransportConfig) {
    this.enabled = config?.enabled ?? process.env.ELASTIC_ENABLED === 'true';
    this.url =
      config?.url ?? process.env.ELASTIC_URL ?? 'http://localhost:9200';
    this.index =
      config?.index ?? process.env.ELASTIC_INDEX ?? 'carbonscribe-logs';
    this.username = config?.username ?? process.env.ELASTIC_USERNAME;
    this.password = config?.password ?? process.env.ELASTIC_PASSWORD;
    this.timeout =
      config?.timeout ?? parseInt(process.env.ELASTIC_TIMEOUT_MS ?? '5000', 10);
    this.maxRetries =
      config?.maxRetries ??
      parseInt(process.env.ELASTIC_MAX_RETRIES ?? '3', 10);
    this.retryDelay =
      config?.retryDelay ??
      parseInt(process.env.ELASTIC_RETRY_DELAY_MS ?? '1000', 10);
    this.sslConfig = config?.ssl;

    // Log configuration on initialization (but not in production to avoid noise)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `ElasticTransport initialized: ${this.url} (enabled: ${this.enabled})`,
      );
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!entry || !this.enabled) {
      return;
    }

    // Skip if we recently failed to reduce load
    if (this.lastError && Date.now() - this.lastError.getTime() < 60000) {
      // Fallback to console for critical logs
      if (entry.level === 'error' || entry.level === 'fatal') {
        // eslint-disable-next-line no-console
        console.warn(
          'Elasticsearch unavailable, logging to console:',
          entry.message,
        );
      }
      return;
    }

    try {
      const formatted = formatStructured(entry);
      const parsed = JSON.parse(formatted);

      // Add index routing with daily rotation
      const index = `${this.index}-${new Date().toISOString().slice(0, 10)}`;

      // Send with retry logic
      await this.sendWithRetry(index, parsed);

      // Reset error state on success
      this.isHealthy = true;
      this.lastError = undefined;
    } catch (error) {
      this.lastError = new Date();
      this.isHealthy = false;

      // Log to console as fallback
      const err = error as Error;
      // eslint-disable-next-line no-console
      console.error('Failed to send log to Elasticsearch:', err.message);

      // Still try to log critical errors to console
      if (entry.level === 'error' || entry.level === 'fatal') {
        // eslint-disable-next-line no-console
        console.error(
          'Critical log that failed to reach Elasticsearch:',
          entry,
        );
      }
    }
  }

  /**
   * Sends a log entry to Elasticsearch with retry logic
   */
  private async sendWithRetry(
    index: string,
    data: Record<string, any>,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.send(index, data);
        return; // Success
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Wait before retry (with exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('All retries exhausted');
  }

  /**
   * Sends a single request to Elasticsearch
   */
  private async send(index: string, data: Record<string, any>): Promise<void> {
    // Import axios dynamically to avoid circular dependencies
    const axios = await import('axios');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication if configured
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString(
        'base64',
      );
      headers['Authorization'] = `Basic ${auth}`;
    }

    const config: any = {
      headers,
      timeout: this.timeout,
    };

    // Configure SSL if provided
    if (this.sslConfig) {
      config.httpsAgent = new (await import('https')).Agent({
        rejectUnauthorized: this.sslConfig.rejectUnauthorized !== false,
        ca: this.sslConfig.ca,
        cert: this.sslConfig.cert,
        key: this.sslConfig.key,
      });
    }

    // Send to Elasticsearch
    await axios.default.post(`${this.url}/${index}/_doc`, data, config);
  }

  /**
   * Checks if an error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    // 4xx errors are usually client errors and shouldn't be retried
    if (error.response) {
      const status = error.response.status;
      if (status >= 400 && status < 500) {
        return true;
      }
    }

    // Check for specific error types
    if (error.code === 'ECONNREFUSED') {
      return false; // Retry connection refused
    }

    if (error.code === 'ETIMEDOUT') {
      return false; // Retry timeouts
    }

    return false;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Checks if the transport is healthy
   */
  async checkHealth(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const axios = await import('axios');
      await axios.default.head(this.url, {
        timeout: 3000,
      });
      this.isHealthy = true;
      return true;
    } catch {
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Gets the current health status
   */
  getHealthStatus(): { healthy: boolean; lastError?: Date } {
    return {
      healthy: this.isHealthy,
      lastError: this.lastError,
    };
  }
}

/**
 * Factory function for creating ElasticTransport with environment-based configuration
 */
export function createElasticTransport(): ElasticTransport {
  return new ElasticTransport({
    enabled: process.env.ELASTIC_ENABLED === 'true',
    url: process.env.ELASTIC_URL,
    index: process.env.ELASTIC_INDEX,
    username: process.env.ELASTIC_USERNAME,
    password: process.env.ELASTIC_PASSWORD,
    timeout: parseInt(process.env.ELASTIC_TIMEOUT_MS ?? '5000', 10),
    maxRetries: parseInt(process.env.ELASTIC_MAX_RETRIES ?? '3', 10),
    retryDelay: parseInt(process.env.ELASTIC_RETRY_DELAY_MS ?? '1000', 10),
  });
}
