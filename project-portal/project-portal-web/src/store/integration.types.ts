export type IntegrationProvider = 'stripe' | 'stellar' | 'sentinel';
export type ConnectionStatus = 'active' | 'inactive' | 'error';
export type WebhookStatus = 'success' | 'failed' | 'pending';
export type HealthStatus = 'healthy' | 'degraded' | 'down';
export type Environment = 'development' | 'staging' | 'production';

export interface IntegrationConnection {
  id: string;
  name: string;
  provider: IntegrationProvider;
  environment: Environment;
  config: Record<string, any>;
  status: ConnectionStatus;
  last_tested?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookConfig {
  id: string;
  project_id?: string;
  url: string;
  events: string[];
  is_active: boolean;
  headers?: Record<string, string>;
  retry_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  response_status: number;
  response_body: string;
  status: WebhookStatus;
  attempt: number;
  next_retry_at?: string;
  created_at: string;
}

export interface EventSubscription {
  id: string;
  subscriber_id: string;
  event_type: string;
  filters?: Record<string, any>;
  callback_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OAuthToken {
  id: string;
  connection_id: string;
  provider: IntegrationProvider;
  token_type: string;
  expires_at: string;
  scope: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationHealth {
  id: string;
  connection_id: string;
  status: HealthStatus;
  latency_ms: number;
  error_rate: number;
  checked_at: string;
  message?: string;
}

export interface CreateConnectionRequest {
  name: string;
  provider: IntegrationProvider;
  environment?: Environment;
  config: Record<string, any>;
}

export interface UpdateConnectionRequest {
  name?: string;
  config?: Record<string, any>;
  status?: ConnectionStatus;
}

export interface TestConnectionRequest {
  id: string;
}

export interface CreateWebhookRequest {
  project_id?: string;
  url: string;
  events: string[];
  headers?: Record<string, string>;
  retry_config?: Record<string, any>;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  is_active?: boolean;
  headers?: Record<string, string>;
  retry_config?: Record<string, any>;
}

export interface CreateSubscriptionRequest {
  subscriber_id: string;
  event_type: string;
  filters?: Record<string, any>;
  callback_url: string;
}

export interface UpdateSubscriptionRequest {
  filters?: Record<string, any>;
  callback_url?: string;
  is_active?: boolean;
}

export interface OAuthAuthorizeRequest {
  provider: IntegrationProvider;
  redirect_uri?: string;
}

export interface OAuthCallbackRequest {
  provider: IntegrationProvider;
  code: string;
  state?: string;
}

export interface ListConnectionsResponse {
  connections: IntegrationConnection[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListWebhooksResponse {
  webhooks: WebhookConfig[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListDeliveriesResponse {
  deliveries: WebhookDelivery[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListSubscriptionsResponse {
  subscriptions: EventSubscription[];
  total: number;
  page: number;
  page_size: number;
}

export interface HealthMetricsResponse {
  connections: IntegrationHealth[];
  overall_status: HealthStatus;
  average_latency: number;
  total_error_rate: number;
}

export interface TestWebhookRequest {
  webhook_id: string;
  event_type: string;
  payload?: Record<string, any>;
}
