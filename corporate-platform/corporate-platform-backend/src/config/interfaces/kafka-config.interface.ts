export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: string;
    username: string;
    password: string;
  };
  retry?: {
    initialRetryTime?: number;
    retries?: number;
  };
  groupId: string;
  producerTimeout: number;
  consumerTimeout: number;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
}
