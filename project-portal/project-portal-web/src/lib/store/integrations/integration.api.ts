import { api } from '@/lib/api/axios';
import { getIntegrationsApiBase } from '@/lib/api';
import { showErrorToast } from '@/lib/utils/toast';
import type { AxiosError, Method } from 'axios';
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

// toRequestError mirrors the previous fetch-based handleResponse's error
// shape and 5xx toast (#799) — the shared axios instance already shows its
// own generic error toast, which this request() opts every call out of via
// suppressErrorToast, so callers see exactly one toast with this message
// rather than two with different wording.
function toRequestError(err: unknown): Error {
  const axiosErr = err as AxiosError;
  if (!axiosErr?.isAxiosError) {
    return err instanceof Error ? err : new Error(String(err));
  }

  const status = axiosErr.response?.status;
  const data = axiosErr.response?.data as ApiError | string | undefined;
  let message = axiosErr.response?.statusText || axiosErr.message || `Request failed`;
  if (data && typeof data === 'object' && typeof data.error === 'string') {
    message = data.error;
  } else if (typeof data === 'string' && data && !data.trim().startsWith('<!') && !data.trim().startsWith('<html')) {
    message = data.length > 200 ? data.slice(0, 200) + '...' : data;
  }

  if (status !== undefined && status >= 500 && status <= 599) {
    showErrorToast('CarbonScribe is having trouble', {
      description: 'A server error occurred. Please try again in a moment.',
      retryable: true,
      id: 'global-5xx',
    });
  }

  const requestError = new Error(message);
  (requestError as Error & { status?: number }).status = status;
  return requestError;
}

// request sends through the shared axios instance (#799) so every call —
// including DELETE and the OAuth endpoints — carries the Authorization
// header the instance already attaches, and a 401 triggers its existing
// refresh-and-retry flow. baseURL is overridden per call, recomputed from
// getIntegrationsApiBase() each time, to preserve its exact existing
// base-URL behaviour (which can differ from the shared instance's own
// default base URL).
async function request<T>(
  method: Method,
  path: string,
  options?: { data?: unknown; params?: Record<string, unknown> },
): Promise<T> {
  try {
    const res = await api.request<T>({
      method,
      url: path,
      baseURL: base(),
      data: options?.data,
      params: options?.params,
      suppressErrorToast: true,
    });
    return res.data;
  } catch (err) {
    throw toRequestError(err);
  }
}

// Connections
export async function apiCreateConnection(body: CreateConnectionRequest): Promise<IntegrationConnection> {
  return request<IntegrationConnection>('POST', '/connections', { data: body });
}

export async function apiListConnections(params?: {
  provider?: string;
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ListConnectionsResponse> {
  return request<ListConnectionsResponse>('GET', '/connections', { params });
}

export async function apiGetConnection(id: string): Promise<IntegrationConnection> {
  return request<IntegrationConnection>('GET', `/connections/${id}`);
}

export async function apiUpdateConnection(id: string, body: UpdateConnectionRequest): Promise<IntegrationConnection> {
  return request<IntegrationConnection>('PUT', `/connections/${id}`, { data: body });
}

export async function apiDeleteConnection(id: string): Promise<void> {
  await request<void>('DELETE', `/connections/${id}`);
}

export async function apiTestConnection(body: TestConnectionRequest): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('POST', `/connections/${body.id}/test`);
}

// Webhooks
export async function apiCreateWebhook(body: CreateWebhookRequest): Promise<WebhookConfig> {
  return request<WebhookConfig>('POST', '/webhooks', { data: body });
}

export async function apiListWebhooks(params?: {
  project_id?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ListWebhooksResponse> {
  return request<ListWebhooksResponse>('GET', '/webhooks', { params });
}

export async function apiGetWebhook(id: string): Promise<WebhookConfig> {
  return request<WebhookConfig>('GET', `/webhooks/${id}`);
}

export async function apiUpdateWebhook(id: string, body: UpdateWebhookRequest): Promise<WebhookConfig> {
  return request<WebhookConfig>('PUT', `/webhooks/${id}`, { data: body });
}

export async function apiDeleteWebhook(id: string): Promise<void> {
  await request<void>('DELETE', `/webhooks/${id}`);
}

export async function apiTestWebhook(body: TestWebhookRequest): Promise<{ success: boolean; response: any }> {
  return request<{ success: boolean; response: any }>('POST', `/webhooks/${body.webhook_id}/test`, {
    data: { event_type: body.event_type, payload: body.payload },
  });
}

export async function apiListWebhookDeliveries(webhookId: string, params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<ListDeliveriesResponse> {
  return request<ListDeliveriesResponse>('GET', `/webhooks/${webhookId}/deliveries`, { params });
}

// Subscriptions
export async function apiCreateSubscription(body: CreateSubscriptionRequest): Promise<EventSubscription> {
  return request<EventSubscription>('POST', '/subscriptions', { data: body });
}

export async function apiListSubscriptions(params?: {
  subscriber_id?: string;
  event_type?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ListSubscriptionsResponse> {
  return request<ListSubscriptionsResponse>('GET', '/subscriptions', { params });
}

export async function apiGetSubscription(id: string): Promise<EventSubscription> {
  return request<EventSubscription>('GET', `/subscriptions/${id}`);
}

export async function apiUpdateSubscription(id: string, body: UpdateSubscriptionRequest): Promise<EventSubscription> {
  return request<EventSubscription>('PUT', `/subscriptions/${id}`, { data: body });
}

export async function apiDeleteSubscription(id: string): Promise<void> {
  await request<void>('DELETE', `/subscriptions/${id}`);
}

// Health
export async function apiGetHealthMetrics(connectionId?: string): Promise<HealthMetricsResponse> {
  return request<HealthMetricsResponse>('GET', '/health', {
    params: connectionId ? { connection_id: connectionId } : undefined,
  });
}

export async function apiGetConnectionHealth(connectionId: string): Promise<IntegrationHealth[]> {
  return request<IntegrationHealth[]>('GET', `/health/${connectionId}`);
}

// OAuth2
export async function apiInitiateOAuth2(provider: string, redirectUri?: string): Promise<{ authorization_url: string }> {
  return request<{ authorization_url: string }>('GET', `/oauth2/authorize/${provider}`, {
    params: redirectUri ? { redirect_uri: redirectUri } : undefined,
  });
}

export async function apiHandleOAuth2Callback(provider: string, code: string, state?: string): Promise<{ success: boolean; message: string }> {
  const body: OAuthCallbackRequest = { provider: provider as any, code, state };
  return request<{ success: boolean; message: string }>('POST', `/oauth2/callback/${provider}`, { data: body });
}
