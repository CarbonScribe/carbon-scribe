import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { KafkaConfig } from '../../config/interfaces/kafka-config.interface';
import { formatStructured } from '../formatters/structured.formatter';

export interface KafkaTransportConfig {
  enabled?: boolean;
  topic?: string;
  clientId?: string;
  brokers?: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  compression?: 'gzip' | 'snappy' | 'lz4' | 'zstd' | 'none';
  acks?: 0 | 1 | -1;
  maxRetries?: number;
  retryDelay?: number;
  reconnectInterval?: number;
}

/**
 * Kafka transport for sending structured logs to Kafka.
 * Supports authentication, SSL, compression, and retry logic.
 */
export class KafkaTransport implements LogTransport {
  private readonly enabled: boolean;
  private readonly topic: string;
  private readonly clientId: string;
  private readonly brokers: string[];
  private readonly ssl: boolean;
  private readonly sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  private readonly retryConfig?: {
    initialRetryTime?: number;
    retries?: number;
  };
  private readonly compression: 'gzip' | 'snappy' | 'lz4' | 'zstd' | 'none';
  private readonly acks: 0 | 1 | -1;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly reconnectInterval: number;

  private producer: any | null = null;
  private isConnected = false;
  private isConnecting = false;
  private lastError?: Date;
  private reconnectTimer?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: KafkaTransportConfig | KafkaConfig) {
    // Handle both config types
    const cfg = config as KafkaTransportConfig;
    this.enabled = cfg.enabled ?? process.env.KAFKA_LOG_ENABLED === 'true';
    this.topic =
      cfg.topic ?? process.env.KAFKA_LOG_TOPIC ?? 'carbonscribe-logs';
    this.clientId =
      cfg.clientId ?? process.env.KAFKA_CLIENT_ID ?? 'carbonscribe-logger';
    this.brokers =
      cfg.brokers ??
      (process.env.KAFKA_BROKERS || '').split(',').filter(Boolean);
    this.ssl = cfg.ssl ?? false;
    this.sasl = cfg.sasl;
    this.retryConfig = cfg.retry;
    this.compression = cfg.compression ?? 'none';
    this.acks = cfg.acks ?? 1;
    this.maxRetries =
      cfg.maxRetries ?? parseInt(process.env.KAFKA_LOG_MAX_RETRIES ?? '3', 10);
    this.retryDelay =
      cfg.retryDelay ??
      parseInt(process.env.KAFKA_LOG_RETRY_DELAY_MS ?? '1000', 10);
    this.reconnectInterval =
      cfg.reconnectInterval ??
      parseInt(process.env.KAFKA_RECONNECT_INTERVAL_MS ?? '30000', 10);

    // Log configuration on initialization (but not in production to avoid noise)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `KafkaTransport initialized: ${this.brokers.join(', ')} (enabled: ${this.enabled})`,
      );
    }

    // Start health check interval
    if (this.enabled) {
      this.startHealthCheck();
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!entry || !this.enabled || this.brokers.length === 0) {
      return;
    }

    // Skip if we recently failed to reduce load
    if (this.lastError && Date.now() - this.lastError.getTime() < 60000) {
      // Fallback to console for critical logs
      if (entry.level === 'error' || entry.level === 'fatal') {
        // eslint-disable-next-line no-console
        console.warn('Kafka unavailable, logging to console:', entry.message);
      }
      return;
    }

    try {
      // Initialize producer if not connected
      if (!this.isConnected && !this.isConnecting) {
        await this.connect();
      }

      // Wait for connection if in progress
      if (this.isConnecting) {
        await this.waitForConnection();
      }

      if (this.producer && this.isConnected) {
        await this.sendWithRetry(entry);
        this.lastError = undefined;
      }
    } catch (error) {
      this.lastError = new Date();
      const err = error as Error;
      // eslint-disable-next-line no-console
      console.error('Failed to send log to Kafka:', err.message);

      // Still try to log critical errors to console
      if (entry.level === 'error' || entry.level === 'fatal') {
        // eslint-disable-next-line no-console
        console.error('Critical log that failed to reach Kafka:', entry);
      }

      // Attempt reconnection
      if (!this.isConnecting) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Sends a log entry to Kafka with retry logic
   */
  private async sendWithRetry(entry: LogEntry): Promise<void> {
    const formatted = formatStructured(entry);

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.producer.send({
          topic: this.topic,
          messages: [
            {
              key: entry.requestId || entry.traceId || entry.timestamp,
              value: formatted,
              headers: {
                'content-type': 'application/json',
                'x-service': entry.service,
                'x-environment': entry.environment,
                'x-level': entry.level,
                ...(entry.requestId ? { 'x-request-id': entry.requestId } : {}),
                ...(entry.traceId ? { 'x-trace-id': entry.traceId } : {}),
                ...(entry.userId ? { 'x-user-id': entry.userId } : {}),
                ...(entry.companyId ? { 'x-company-id': entry.companyId } : {}),
                ...(entry.workflowStage
                  ? { 'x-workflow-stage': entry.workflowStage }
                  : {}),
              },
            },
          ],
          compression: this.compression,
          acks: this.acks,
          timeout: 5000,
        });
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
   * Connects to Kafka
   */
  private async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;

    try {
      const { Kafka } = await import('kafkajs');

      const kafka = new Kafka({
        clientId: this.clientId,
        brokers: this.brokers,
        ssl: this.ssl,
        sasl: this.sasl as any,
        retry: {
          initialRetryTime: this.retryConfig?.initialRetryTime || 300,
          retries: this.retryConfig?.retries || 5,
          ...(this.retryConfig || {}),
        },
        connectionTimeout: 3000,
        requestTimeout: 5000,
      });

      this.producer = kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
        idempotent: false,
      });

      // Connect with timeout
      await Promise.race([
        this.producer.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Kafka connection timeout')), 5000),
        ),
      ]);

      this.isConnected = true;
      this.isConnecting = false;

      // Clear any reconnection timer on successful connection
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      // eslint-disable-next-line no-console
      console.log(`KafkaTransport connected to ${this.brokers.join(', ')}`);
    } catch (error) {
      this.isConnected = false;
      this.isConnecting = false;
      const err = error as Error;
      // eslint-disable-next-line no-console
      console.error('Failed to connect to Kafka:', err.message);
      throw error;
    }
  }

  /**
   * Waits for connection to complete
   */
  private async waitForConnection(): Promise<void> {
    const timeout = 10000;
    const start = Date.now();

    while (this.isConnecting) {
      if (Date.now() - start > timeout) {
        throw new Error('Connection timeout');
      }
      await this.sleep(100);
    }

    if (!this.isConnected) {
      throw new Error('Connection failed');
    }
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.isConnected && !this.isConnecting) {
        this.connect().catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Reconnection attempt failed:', error);
          this.scheduleReconnect();
        });
      }
    }, this.reconnectInterval);
  }

  /**
   * Starts the health check interval
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (this.isConnected && this.producer) {
        try {
          // Check connection by attempting to get metadata
          const admin = this.producer.admin?.();
          if (admin) {
            await admin.listTopics();
          }
        } catch {
          this.isConnected = false;
          this.scheduleReconnect();
        }
      }
    }, this.reconnectInterval);
  }

  /**
   * Checks if an error is non-retryable
   */
  private isNonRetryableError(error: any): boolean {
    // Topic authorization errors are not retryable
    if (error.message?.includes('Authorization')) {
      return true;
    }

    if (error.message?.includes('Not enough replicas')) {
      return false; // Retry
    }

    if (error.message?.includes('Message size too large')) {
      return true; // Non-retryable
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
   * Disconnects from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        // eslint-disable-next-line no-console
        console.log('KafkaTransport disconnected');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error disconnecting from Kafka:', error);
      }
    }
  }

  /**
   * Checks if the transport is healthy
   */
  async checkHealth(): Promise<boolean> {
    if (!this.enabled || this.brokers.length === 0) {
      return false;
    }

    try {
      if (!this.isConnected && !this.isConnecting) {
        await this.connect();
      }
      return this.isConnected;
    } catch {
      return false;
    }
  }

  /**
   * Gets the current health status
   */
  getHealthStatus(): {
    healthy: boolean;
    connected: boolean;
    connecting: boolean;
    lastError?: Date;
    brokers: string[];
  } {
    return {
      healthy: this.isConnected && !this.lastError,
      connected: this.isConnected,
      connecting: this.isConnecting,
      lastError: this.lastError,
      brokers: this.brokers,
    };
  }
}

/**
 * Factory function for creating KafkaTransport with environment-based configuration
 */
export function createKafkaTransport(
  config?: Partial<KafkaTransportConfig>,
): KafkaTransport {
  return new KafkaTransport({
    enabled: config?.enabled ?? process.env.KAFKA_LOG_ENABLED === 'true',
    topic: config?.topic ?? process.env.KAFKA_LOG_TOPIC ?? 'carbonscribe-logs',
    clientId:
      config?.clientId ?? process.env.KAFKA_CLIENT_ID ?? 'carbonscribe-logger',
    brokers:
      config?.brokers ??
      (process.env.KAFKA_BROKERS || '').split(',').filter(Boolean),
    ssl: config?.ssl ?? process.env.KAFKA_SSL_ENABLED === 'true',
    sasl:
      config?.sasl ??
      (process.env.KAFKA_SASL_MECHANISM && process.env.KAFKA_SASL_USERNAME
        ? {
            mechanism: process.env.KAFKA_SASL_MECHANISM as
              | 'plain'
              | 'scram-sha-256'
              | 'scram-sha-512',
            username: process.env.KAFKA_SASL_USERNAME,
            password: process.env.KAFKA_SASL_PASSWORD,
          }
        : undefined),
    maxRetries:
      config?.maxRetries ??
      parseInt(process.env.KAFKA_LOG_MAX_RETRIES ?? '3', 10),
    retryDelay:
      config?.retryDelay ??
      parseInt(process.env.KAFKA_LOG_RETRY_DELAY_MS ?? '1000', 10),
    reconnectInterval:
      config?.reconnectInterval ??
      parseInt(process.env.KAFKA_RECONNECT_INTERVAL_MS ?? '30000', 10),
    ...config,
  });
}
