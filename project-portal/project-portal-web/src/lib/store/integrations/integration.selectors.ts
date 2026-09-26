import { useStore } from '../store';
import type {
  IntegrationConnection,
  WebhookConfig,
  EventSubscription,
  IntegrationHealth,
} from './integration.types';

export function useActiveConnections(): IntegrationConnection[] {
  return useStore((state) => state.connections.filter((c) => c.status === 'active'));
}

export function useConnectionsByProvider(provider: string): IntegrationConnection[] {
  return useStore((state) => state.connections.filter((c) => c.provider === provider));
}

export function useActiveWebhooks(): WebhookConfig[] {
  return useStore((state) => state.webhooks.filter((w) => w.is_active));
}

export function useWebhooksByProject(projectId: string): WebhookConfig[] {
  return useStore((state) => state.webhooks.filter((w) => w.project_id === projectId));
}

export function useActiveSubscriptions(): EventSubscription[] {
  return useStore((state) => state.subscriptions.filter((s) => s.is_active));
}

export function useFailedDeliveries() {
  return useStore((state) => state.deliveries.filter((d) => d.status === 'failed'));
}

export function useRecentHealthChecks(limit = 10): IntegrationHealth[] {
  return useStore((state) => state.integrationConnectionHealth.slice(0, limit));
}

export function useOverallHealthStatus(): string {
  return useStore((state) => state.integrationHealthMetrics?.overall_status ?? 'unknown');
}

export function useAverageLatency(): number {
  return useStore((state) => state.integrationHealthMetrics?.average_latency ?? 0);
}

export function useTotalErrorRate(): number {
  return useStore((state) => state.integrationHealthMetrics?.total_error_rate ?? 0);
}

export function useConnectionsStatus() {
  return useStore((state) => ({
    loading: state.connectionsLoading,
    error: state.connectionsError,
  }));
}

export function useWebhooksStatus() {
  return useStore((state) => ({
    loading: state.webhooksLoading,
    error: state.webhooksError,
  }));
}

export function useSubscriptionsStatus() {
  return useStore((state) => ({
    loading: state.subscriptionsLoading,
    error: state.subscriptionsError,
  }));
}

export function useHealthStatus() {
  return useStore((state) => ({
    loading: state.integrationHealthLoading,
    error: state.integrationHealthError,
  }));
}

export function useOAuthStatus() {
  return useStore((state) => ({
    loading: state.oauthLoading,
    error: state.oauthError,
  }));
}
