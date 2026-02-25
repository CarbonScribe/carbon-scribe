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
}
