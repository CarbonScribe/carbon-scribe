import { useIntegrationStore } from './integrationSlice';
import type {
  IntegrationConnection,
  WebhookConfig,
  EventSubscription,
  IntegrationHealth,
} from './integration.types';

export function useActiveConnections(): IntegrationConnection[] {
  return useIntegrationStore((state) => state.connections.filter((c) => c.status === 'active'));
}

export function useConnectionsByProvider(provider: string): IntegrationConnection[] {
  return useIntegrationStore((state) => state.connections.filter((c) => c.provider === provider));
}

export function useActiveWebhooks(): WebhookConfig[] {
  return useIntegrationStore((state) => state.webhooks.filter((w) => w.is_active));
}

export function useWebhooksByProject(projectId: string): WebhookConfig[] {
  return useIntegrationStore((state) => state.webhooks.filter((w) => w.project_id === projectId));
}

export function useActiveSubscriptions(): EventSubscription[] {
  return useIntegrationStore((state) => state.subscriptions.filter((s) => s.is_active));
}

export function useFailedDeliveries() {
  return useIntegrationStore((state) => state.deliveries.filter((d) => d.status === 'failed'));
}

export function useRecentHealthChecks(limit = 10): IntegrationHealth[] {
  return useIntegrationStore((state) => state.connectionHealth.slice(0, limit));
}

export function useOverallHealthStatus(): string {
  return useIntegrationStore((state) => state.healthMetrics?.overall_status ?? 'unknown');
}

export function useAverageLatency(): number {
  return useIntegrationStore((state) => state.healthMetrics?.average_latency ?? 0);
}

export function useTotalErrorRate(): number {
  return useIntegrationStore((state) => state.healthMetrics?.total_error_rate ?? 0);
}

export function useConnectionsStatus() {
  return useIntegrationStore((state) => ({
    loading: state.connectionsLoading,
    error: state.connectionsError,
  }));
}

export function useWebhooksStatus() {
  return useIntegrationStore((state) => ({
    loading: state.webhooksLoading,
    error: state.webhooksError,
  }));
}

export function useSubscriptionsStatus() {
  return useIntegrationStore((state) => ({
    loading: state.subscriptionsLoading,
    error: state.subscriptionsError,
  }));
}

export function useHealthStatus() {
  return useIntegrationStore((state) => ({
    loading: state.healthLoading,
    error: state.healthError,
  }));
}

export function useOAuthStatus() {
  return useIntegrationStore((state) => ({
    loading: state.oauthLoading,
    error: state.oauthError,
  }));
}
