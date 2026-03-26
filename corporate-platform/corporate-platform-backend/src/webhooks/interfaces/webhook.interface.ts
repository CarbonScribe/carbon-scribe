export enum WebhookStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum OperationType {
  TRANSFER = 'TRANSFER',
  RETIREMENT = 'RETIREMENT',
  MINT = 'MINT',
}

export interface WebhookPayload {
  eventType: string;
  timestamp: string;
  data: any;
}

export interface IWebhookHandler {
  handle(payload: any): Promise<void>;
  supports(eventType: string): boolean;
}
