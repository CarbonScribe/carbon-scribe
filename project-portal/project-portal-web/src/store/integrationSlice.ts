import { create } from 'zustand';
import type {
  IntegrationConnection,
  WebhookConfig,
  WebhookDelivery,
  EventSubscription,
  IntegrationHealth,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  ListConnectionsResponse,
  ListWebhooksResponse,
  ListDeliveriesResponse,
  ListSubscriptionsResponse,
  HealthMetricsResponse,
  TestWebhookRequest,
} from './integration.types';
import * as api from './integration.api';

export interface IntegrationSlice {
  // Connections
  connections: IntegrationConnection[];
  connectionsTotal: number;
  connectionsPage: number;
  connectionsLoading: boolean;
  connectionsError: string | null;
  currentConnection: IntegrationConnection | null;
  fetchConnections: (params?: Parameters<typeof api.apiListConnections>[0]) => Promise<void>;
  fetchConnection: (id: string) => Promise<void>;
  createConnection: (body: CreateConnectionRequest) => Promise<IntegrationConnection>;
  updateConnection: (id: string, body: UpdateConnectionRequest) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; message: string }>;
  setCurrentConnection: (conn: IntegrationConnection | null) => void;
  clearCurrentConnection: () => void;

  // Webhooks
  webhooks: WebhookConfig[];
  webhooksTotal: number;
  webhooksPage: number;
  webhooksLoading: boolean;
  webhooksError: string | null;
  currentWebhook: WebhookConfig | null;
  fetchWebhooks: (params?: Parameters<typeof api.apiListWebhooks>[0]) => Promise<void>;
  fetchWebhook: (id: string) => Promise<void>;
  createWebhook: (body: CreateWebhookRequest) => Promise<WebhookConfig>;
  updateWebhook: (id: string, body: UpdateWebhookRequest) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  testWebhook: (body: TestWebhookRequest) => Promise<{ success: boolean; response: any }>;
  setCurrentWebhook: (webhook: WebhookConfig | null) => void;
  clearCurrentWebhook: () => void;

  // Webhook Deliveries
  deliveries: WebhookDelivery[];
  deliveriesTotal: number;
  deliveriesLoading: boolean;
  deliveriesError: string | null;
  fetchDeliveries: (webhookId: string, params?: Parameters<typeof api.apiListWebhookDeliveries>[1]) => Promise<void>;

  // Subscriptions
  subscriptions: EventSubscription[];
  subscriptionsTotal: number;
  subscriptionsPage: number;
  subscriptionsLoading: boolean;
  subscriptionsError: string | null;
  currentSubscription: EventSubscription | null;
  fetchSubscriptions: (params?: Parameters<typeof api.apiListSubscriptions>[0]) => Promise<void>;
  fetchSubscription: (id: string) => Promise<void>;
  createSubscription: (body: CreateSubscriptionRequest) => Promise<EventSubscription>;
  updateSubscription: (id: string, body: UpdateSubscriptionRequest) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  setCurrentSubscription: (sub: EventSubscription | null) => void;
  clearCurrentSubscription: () => void;

  // Health
  healthMetrics: HealthMetricsResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  connectionHealth: IntegrationHealth[];
  connectionHealthLoading: boolean;
  connectionHealthError: string | null;
  fetchHealthMetrics: (connectionId?: string) => Promise<void>;
  fetchConnectionHealth: (connectionId: string) => Promise<void>;

  // OAuth2
  oauthLoading: boolean;
  oauthError: string | null;
  initiateOAuth2: (provider: string, redirectUri?: string) => Promise<string>;
  handleOAuth2Callback: (provider: string, code: string, state?: string) => Promise<void>;

  // General
  clearIntegrations: () => void;
}

const initialState = {
  connections: [],
  connectionsTotal: 0,
  connectionsPage: 1,
  connectionsLoading: false,
  connectionsError: null as string | null,
  currentConnection: null as IntegrationConnection | null,
  webhooks: [],
  webhooksTotal: 0,
  webhooksPage: 1,
  webhooksLoading: false,
  webhooksError: null as string | null,
  currentWebhook: null as WebhookConfig | null,
  deliveries: [],
  deliveriesTotal: 0,
  deliveriesLoading: false,
  deliveriesError: null as string | null,
  subscriptions: [],
  subscriptionsTotal: 0,
  subscriptionsPage: 1,
  subscriptionsLoading: false,
  subscriptionsError: null as string | null,
  currentSubscription: null as EventSubscription | null,
  healthMetrics: null as HealthMetricsResponse | null,
  healthLoading: false,
  healthError: null as string | null,
  connectionHealth: [],
  connectionHealthLoading: false,
  connectionHealthError: null as string | null,
  oauthLoading: false,
  oauthError: null as string | null,
};

export const useIntegrationStore = create<IntegrationSlice>((set, get) => ({
  ...initialState,

  // Connections
  fetchConnections: async (params) => {
    set({ connectionsLoading: true, connectionsError: null });
    try {
      const res = await api.apiListConnections(params);
      set({
        connections: res.connections,
        connectionsTotal: res.total,
        connectionsPage: res.page,
        connectionsLoading: false,
        connectionsError: null,
      });
    } catch (error) {
      set({ connectionsLoading: false, connectionsError: error instanceof Error ? error.message : 'Failed to fetch connections' });
    }
  },

  fetchConnection: async (id) => {
    set({ connectionsError: null });
    try {
      const connection = await api.apiGetConnection(id);
      set({ currentConnection: connection });
    } catch (error) {
      set({ currentConnection: null, connectionsError: error instanceof Error ? error.message : 'Failed to fetch connection' });
    }
  },

  createConnection: async (body) => {
    const connection = await api.apiCreateConnection(body);
    set((s) => ({ connections: [connection, ...s.connections], connectionsTotal: s.connectionsTotal + 1, currentConnection: connection }));
    return connection;
  },

  updateConnection: async (id, body) => {
    const updated = await api.apiUpdateConnection(id, body);
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? updated : c)),
      currentConnection: s.currentConnection?.id === id ? updated : s.currentConnection,
    }));
  },

  deleteConnection: async (id) => {
    await api.apiDeleteConnection(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      connectionsTotal: Math.max(0, s.connectionsTotal - 1),
      currentConnection: s.currentConnection?.id === id ? null : s.currentConnection,
    }));
  },

  testConnection: async (id) => {
    return api.apiTestConnection({ id });
  },

  setCurrentConnection: (conn) => set({ currentConnection: conn }),
  clearCurrentConnection: () => set({ currentConnection: null }),

  // Webhooks
  fetchWebhooks: async (params) => {
    set({ webhooksLoading: true, webhooksError: null });
    try {
      const res = await api.apiListWebhooks(params);
      set({
        webhooks: res.webhooks,
        webhooksTotal: res.total,
        webhooksPage: res.page,
        webhooksLoading: false,
        webhooksError: null,
      });
    } catch (error) {
      set({ webhooksLoading: false, webhooksError: error instanceof Error ? error.message : 'Failed to fetch webhooks' });
    }
  },

  fetchWebhook: async (id) => {
    set({ webhooksError: null });
    try {
      const webhook = await api.apiGetWebhook(id);
      set({ currentWebhook: webhook });
    } catch (error) {
      set({ currentWebhook: null, webhooksError: error instanceof Error ? error.message : 'Failed to fetch webhook' });
    }
  },

  createWebhook: async (body) => {
    const webhook = await api.apiCreateWebhook(body);
    set((s) => ({ webhooks: [webhook, ...s.webhooks], webhooksTotal: s.webhooksTotal + 1, currentWebhook: webhook }));
    return webhook;
  },

  updateWebhook: async (id, body) => {
    const updated = await api.apiUpdateWebhook(id, body);
    set((s) => ({
      webhooks: s.webhooks.map((w) => (w.id === id ? updated : w)),
      currentWebhook: s.currentWebhook?.id === id ? updated : s.currentWebhook,
    }));
  },

  deleteWebhook: async (id) => {
    await api.apiDeleteWebhook(id);
    set((s) => ({
      webhooks: s.webhooks.filter((w) => w.id !== id),
      webhooksTotal: Math.max(0, s.webhooksTotal - 1),
      currentWebhook: s.currentWebhook?.id === id ? null : s.currentWebhook,
    }));
  },

  testWebhook: async (body) => {
    return api.apiTestWebhook(body);
  },

  setCurrentWebhook: (webhook) => set({ currentWebhook: webhook }),
  clearCurrentWebhook: () => set({ currentWebhook: null }),

  // Deliveries
  fetchDeliveries: async (webhookId, params) => {
    set({ deliveriesLoading: true, deliveriesError: null });
    try {
      const res = await api.apiListWebhookDeliveries(webhookId, params);
      set({
        deliveries: res.deliveries,
        deliveriesTotal: res.total,
        deliveriesLoading: false,
        deliveriesError: null,
      });
    } catch (error) {
      set({ deliveriesLoading: false, deliveriesError: error instanceof Error ? error.message : 'Failed to fetch deliveries' });
    }
  },

  // Subscriptions
  fetchSubscriptions: async (params) => {
    set({ subscriptionsLoading: true, subscriptionsError: null });
    try {
      const res = await api.apiListSubscriptions(params);
      set({
        subscriptions: res.subscriptions,
        subscriptionsTotal: res.total,
        subscriptionsPage: res.page,
        subscriptionsLoading: false,
        subscriptionsError: null,
      });
    } catch (error) {
      set({ subscriptionsLoading: false, subscriptionsError: error instanceof Error ? error.message : 'Failed to fetch subscriptions' });
    }
  },

  fetchSubscription: async (id) => {
    set({ subscriptionsError: null });
    try {
      const subscription = await api.apiGetSubscription(id);
      set({ currentSubscription: subscription });
    } catch (error) {
      set({ currentSubscription: null, subscriptionsError: error instanceof Error ? error.message : 'Failed to fetch subscription' });
    }
  },

  createSubscription: async (body) => {
    const subscription = await api.apiCreateSubscription(body);
    set((s) => ({ subscriptions: [subscription, ...s.subscriptions], subscriptionsTotal: s.subscriptionsTotal + 1, currentSubscription: subscription }));
    return subscription;
  },

  updateSubscription: async (id, body) => {
    const updated = await api.apiUpdateSubscription(id, body);
    set((s) => ({
      subscriptions: s.subscriptions.map((sub) => (sub.id === id ? updated : sub)),
      currentSubscription: s.currentSubscription?.id === id ? updated : s.currentSubscription,
    }));
  },

  deleteSubscription: async (id) => {
    await api.apiDeleteSubscription(id);
    set((s) => ({
      subscriptions: s.subscriptions.filter((sub) => sub.id !== id),
      subscriptionsTotal: Math.max(0, s.subscriptionsTotal - 1),
      currentSubscription: s.currentSubscription?.id === id ? null : s.currentSubscription,
    }));
  },

  setCurrentSubscription: (sub) => set({ currentSubscription: sub }),
  clearCurrentSubscription: () => set({ currentSubscription: null }),

  // Health
  fetchHealthMetrics: async (connectionId) => {
    set({ healthLoading: true, healthError: null });
    try {
      const metrics = await api.apiGetHealthMetrics(connectionId);
      set({ healthMetrics: metrics, healthLoading: false, healthError: null });
    } catch (error) {
      set({ healthLoading: false, healthError: error instanceof Error ? error.message : 'Failed to fetch health metrics' });
    }
  },

  fetchConnectionHealth: async (connectionId) => {
    set({ connectionHealthLoading: true, connectionHealthError: null });
    try {
      const health = await api.apiGetConnectionHealth(connectionId);
      set({ connectionHealth: health, connectionHealthLoading: false, connectionHealthError: null });
    } catch (error) {
      set({ connectionHealthLoading: false, connectionHealthError: error instanceof Error ? error.message : 'Failed to fetch connection health' });
    }
  },

  // OAuth2
  initiateOAuth2: async (provider, redirectUri) => {
    set({ oauthLoading: true, oauthError: null });
    try {
      const res = await api.apiInitiateOAuth2(provider, redirectUri);
      set({ oauthLoading: false });
      return res.authorization_url;
    } catch (error) {
      set({ oauthLoading: false, oauthError: error instanceof Error ? error.message : 'Failed to initiate OAuth2' });
      throw error;
    }
  },

  handleOAuth2Callback: async (provider, code, state) => {
    set({ oauthLoading: true, oauthError: null });
    try {
      await api.apiHandleOAuth2Callback(provider, code, state);
      set({ oauthLoading: false });
    } catch (error) {
      set({ oauthLoading: false, oauthError: error instanceof Error ? error.message : 'Failed to handle OAuth2 callback' });
      throw error;
    }
  },

  clearIntegrations: () => set(initialState),
}));
