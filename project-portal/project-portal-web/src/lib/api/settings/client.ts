import { api } from "@/lib/api/axios";
import { handleSettingsError } from "@/lib/errors/settingsErrors";
import type {
  UserProfile,
  UpdateProfilePayload,
  NotificationPreference,
  UpdateNotificationPayload,
  APIKey,
  CreateAPIKeyPayload,
  APIKeyWithSecret,
  APIKeyValidation,
  APIKeyUsage,
  IntegrationConfiguration,
  ConfigureIntegrationPayload,
  IntegrationHealth,
  OAuthStartResponse,
  OAuthCallbackPayload,
  BillingSummary,
  Invoice,
  PaymentMethodPayload,
} from "./types";

const SETTINGS_BASE = "/settings";

// Profile methods
export async function getProfile(segmented?: boolean): Promise<UserProfile> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/profile`, {
      params: { segmented },
    });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<UserProfile> {
  try {
    const res = await api.put(`${SETTINGS_BASE}/profile`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function deleteProfile(): Promise<{ message: string }> {
  try {
    const res = await api.delete(`${SETTINGS_BASE}/profile`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function uploadProfilePicture(file: File): Promise<{
  profile_picture_url: string;
}> {
  try {
    const formData = new FormData();
    formData.append("picture", file);
    const res = await api.post(`${SETTINGS_BASE}/profile/picture`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function exportProfile(format: "json" | "csv"): Promise<Blob> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/profile/export`, {
      params: { format },
      responseType: "blob",
    });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

// Notifications methods
export async function getNotifications(): Promise<NotificationPreference> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/notifications`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function updateNotifications(
  payload: UpdateNotificationPayload
): Promise<NotificationPreference> {
  try {
    const res = await api.put(`${SETTINGS_BASE}/notifications`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

// API Keys methods
export async function getAPIKeys(): Promise<APIKey[]> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/api-keys`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function createAPIKey(
  payload: CreateAPIKeyPayload
): Promise<APIKeyWithSecret> {
  try {
    const res = await api.post(`${SETTINGS_BASE}/api-keys`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function validateAPIKey(key: string): Promise<APIKeyValidation> {
  try {
    const res = await api.post(`${SETTINGS_BASE}/api-keys/validate`, { key });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function deleteAPIKey(keyId: string): Promise<{ message: string }> {
  try {
    const res = await api.delete(`${SETTINGS_BASE}/api-keys/${keyId}`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function rotateAPIKey(keyId: string): Promise<APIKeyWithSecret> {
  try {
    const res = await api.post(
      `${SETTINGS_BASE}/api-keys/${keyId}/rotate`,
      {}
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getAPIKeyUsage(keyId: string): Promise<APIKeyUsage> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/api-keys/${keyId}/usage`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function configureAPIKeyWebhook(
  keyId: string,
  webhookUrl: string
): Promise<{ message: string }> {
  try {
    const res = await api.post(
      `${SETTINGS_BASE}/api-keys/${keyId}/webhooks`,
      { webhook_url: webhookUrl }
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

// Integrations methods
export async function getIntegrations(): Promise<IntegrationConfiguration[]> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/integrations`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function configureIntegration(
  payload: ConfigureIntegrationPayload
): Promise<IntegrationConfiguration> {
  try {
    const res = await api.post(`${SETTINGS_BASE}/integrations`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function configureBatchIntegrations(
  integrations: ConfigureIntegrationPayload[]
): Promise<IntegrationConfiguration[]> {
  try {
    const res = await api.post(`${SETTINGS_BASE}/integrations/batch`, {
      integrations,
    });
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getIntegrationHealth(
  integrationId: string
): Promise<IntegrationHealth> {
  try {
    const res = await api.get(
      `${SETTINGS_BASE}/integrations/${integrationId}/health`
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function startOAuthFlow(
  provider: string
): Promise<OAuthStartResponse> {
  try {
    const res = await api.get(
      `${SETTINGS_BASE}/integrations/oauth/${provider}/start`
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function completeOAuthCallback(
  provider: string,
  payload: OAuthCallbackPayload
): Promise<IntegrationConfiguration> {
  try {
    const res = await api.post(
      `${SETTINGS_BASE}/integrations/oauth/${provider}/callback`,
      payload
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

// Billing methods
export async function getBillingSummary(): Promise<BillingSummary> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/billing`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  try {
    const res = await api.get(`${SETTINGS_BASE}/billing/invoices`);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function downloadInvoicePDF(invoiceId: string): Promise<Blob> {
  try {
    const res = await api.get(
      `${SETTINGS_BASE}/billing/invoices/${invoiceId}/pdf`,
      { responseType: "blob" }
    );
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

export async function addPaymentMethod(
  payload: PaymentMethodPayload
): Promise<{ message: string; payment_method_id: string }> {
  try {
    const res = await api.post(`${SETTINGS_BASE}/billing/payment-method`, payload);
    return res.data;
  } catch (error) {
    handleSettingsError(error);
  }
}

// Export all as namespace for easier imports
export const settingsClient = {
  profile: {
    get: getProfile,
    update: updateProfile,
    delete: deleteProfile,
    uploadPicture: uploadProfilePicture,
    export: exportProfile,
  },
  notifications: {
    get: getNotifications,
    update: updateNotifications,
  },
  apiKeys: {
    list: getAPIKeys,
    create: createAPIKey,
    validate: validateAPIKey,
    delete: deleteAPIKey,
    rotate: rotateAPIKey,
    getUsage: getAPIKeyUsage,
    configureWebhook: configureAPIKeyWebhook,
  },
  integrations: {
    list: getIntegrations,
    configure: configureIntegration,
    configureBatch: configureBatchIntegrations,
    getHealth: getIntegrationHealth,
    startOAuth: startOAuthFlow,
    completeOAuthCallback,
  },
  billing: {
    getSummary: getBillingSummary,
    getInvoices,
    downloadInvoicePDF,
    addPaymentMethod,
  },
};
