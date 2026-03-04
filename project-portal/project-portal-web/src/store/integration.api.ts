import { getIntegrationsApiBase } from '@/lib/api';
import type {
  IntegrationConnection,
  WebhookConfig,
  WebhookDelivery,
  EventSubscription,
  IntegrationHealth,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  OAuthAuthorizeRequest,
  OAuthCallbackRequest,
  ListConnectionsResponse,
  ListWebhooksResponse,
  ListDeliveriesResponse,
  ListSubscriptionsResponse,
  HealthMetricsResponse,
  TestWebhookRequest,
} from './integration.types';
import type { ApiError } from '@/lib/api';

const base = () => getIntegrationsApiBase();

function defaultHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  return h;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const j = JSON.parse(text) as ApiError;
      if (j.error) message = j.error;
    } catch {
      if (text && !text.trim().startsWith('<!') && !text.trim().startsWith('<html')) {
        message = text.length > 200 ? text.slice(0, 200) + '...' : text;
      }
    }
    throw new Error(message);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// Connections
export async function apiCreateConnection(body: CreateConnectionRequest): Promise<IntegrationConnection> {
  const res = await fetch(`${base()}/connections`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<IntegrationConnection>(res);
}

export async function apiListConnections(params?: {
  provider?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ListConnectionsResponse> {
  const q = new URLSearchParams();
  if (params?.provider) q.set('provider', params.provider);
  if (params?.status) q.set('status', params.status);
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const url = `${base()}/connections?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<ListConnectionsResponse>(res);
}

export async function apiGetConnection(id: string): Promise<IntegrationConnection> {
  const res = await fetch(`${base()}/connections/${id}`, { headers: defaultHeaders() });
  return handleResponse<IntegrationConnection>(res);
}

export async function apiUpdateConnection(id: string, body: UpdateConnectionRequest): Promise<IntegrationConnection> {
  const res = await fetch(`${base()}/connections/${id}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<IntegrationConnection>(res);
}

export async function apiDeleteConnection(id: string): Promise<void> {
  const res = await fetch(`${base()}/connections/${id}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiTestConnection(body: TestConnectionRequest): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${base()}/connections/${body.id}/test`, {
    method: 'POST',
    headers: defaultHeaders(),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}

// Webhooks
export async function apiCreateWebhook(body: CreateWebhookRequest): Promise<WebhookConfig> {
  const res = await fetch(`${base()}/webhooks`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<WebhookConfig>(res);
}

export async function apiListWebhooks(params?: {
  project_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ListWebhooksResponse> {
  const q = new URLSearchParams();
  if (params?.project_id) q.set('project_id', params.project_id);
  if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const url = `${base()}/webhooks?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<ListWebhooksResponse>(res);
}

export async function apiGetWebhook(id: string): Promise<WebhookConfig> {
  const res = await fetch(`${base()}/webhooks/${id}`, { headers: defaultHeaders() });
  return handleResponse<WebhookConfig>(res);
}

export async function apiUpdateWebhook(id: string, body: UpdateWebhookRequest): Promise<WebhookConfig> {
  const res = await fetch(`${base()}/webhooks/${id}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<WebhookConfig>(res);
}

export async function apiDeleteWebhook(id: string): Promise<void> {
  const res = await fetch(`${base()}/webhooks/${id}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

export async function apiTestWebhook(body: TestWebhookRequest): Promise<{ success: boolean; response: any }> {
  const res = await fetch(`${base()}/webhooks/${body.webhook_id}/test`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ event_type: body.event_type, payload: body.payload }),
  });
  return handleResponse<{ success: boolean; response: any }>(res);
}

export async function apiListWebhookDeliveries(webhookId: string, params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ListDeliveriesResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const url = `${base()}/webhooks/${webhookId}/deliveries?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<ListDeliveriesResponse>(res);
}

// Subscriptions
export async function apiCreateSubscription(body: CreateSubscriptionRequest): Promise<EventSubscription> {
  const res = await fetch(`${base()}/subscriptions`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<EventSubscription>(res);
}

export async function apiListSubscriptions(params?: {
  subscriber_id?: string;
  event_type?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ListSubscriptionsResponse> {
  const q = new URLSearchParams();
  if (params?.subscriber_id) q.set('subscriber_id', params.subscriber_id);
  if (params?.event_type) q.set('event_type', params.event_type);
  if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
  if (params?.page !== undefined) q.set('page', String(params.page));
  if (params?.page_size !== undefined) q.set('page_size', String(params.page_size));
  const url = `${base()}/subscriptions?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<ListSubscriptionsResponse>(res);
}

export async function apiGetSubscription(id: string): Promise<EventSubscription> {
  const res = await fetch(`${base()}/subscriptions/${id}`, { headers: defaultHeaders() });
  return handleResponse<EventSubscription>(res);
}

export async function apiUpdateSubscription(id: string, body: UpdateSubscriptionRequest): Promise<EventSubscription> {
  const res = await fetch(`${base()}/subscriptions/${id}`, {
    method: 'PUT',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<EventSubscription>(res);
}

export async function apiDeleteSubscription(id: string): Promise<void> {
  const res = await fetch(`${base()}/subscriptions/${id}`, { method: 'DELETE' });
  if (!res.ok) await handleResponse<ApiError>(res);
}

// Health
export async function apiGetHealthMetrics(connectionId?: string): Promise<HealthMetricsResponse> {
  const url = connectionId ? `${base()}/health?connection_id=${connectionId}` : `${base()}/health`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<HealthMetricsResponse>(res);
}

export async function apiGetConnectionHealth(connectionId: string): Promise<IntegrationHealth[]> {
  const res = await fetch(`${base()}/health/${connectionId}`, { headers: defaultHeaders() });
  return handleResponse<IntegrationHealth[]>(res);
}

// OAuth2
export async function apiInitiateOAuth2(provider: string, redirectUri?: string): Promise<{ authorization_url: string }> {
  const q = new URLSearchParams();
  if (redirectUri) q.set('redirect_uri', redirectUri);
  const url = `${base()}/oauth2/authorize/${provider}?${q.toString()}`;
  const res = await fetch(url, { headers: defaultHeaders() });
  return handleResponse<{ authorization_url: string }>(res);
}

export async function apiHandleOAuth2Callback(provider: string, code: string, state?: string): Promise<{ success: boolean; message: string }> {
  const body: OAuthCallbackRequest = { provider: provider as any, code, state };
  const res = await fetch(`${base()}/oauth2/callback/${provider}`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse<{ success: boolean; message: string }>(res);
}
