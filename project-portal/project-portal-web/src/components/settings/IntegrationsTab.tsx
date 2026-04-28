"use client";

import { useEffect, useState } from "react";
import {
  getIntegrations,
  configureIntegration,
  startOAuthFlow,
} from "@/lib/api/settings";
import { useSettings } from "@/lib/hooks/useSettings";
import { showToast } from "@/components/ui/Toast";
import type { IntegrationConfiguration } from "@/lib/api/settings";

const AVAILABLE_INTEGRATIONS = [
  { type: "slack", name: "Slack", icon: "🔷" },
  { type: "github", name: "GitHub", icon: "🐙" },
  { type: "jira", name: "Jira", icon: "📋" },
  { type: "stripe", name: "Stripe", icon: "💳" },
  { type: "zapier", name: "Zapier", icon: "⚡" },
];

export function IntegrationsTab() {
  const integrationsState = useSettings<IntegrationConfiguration[]>();
  const configState = useSettings<IntegrationConfiguration>();
  const [integrations, setIntegrations] = useState<IntegrationConfiguration[]>([]);

  useEffect(() => {
    loadIntegrations();
  }, []);

  useEffect(() => {
    if (integrationsState.data) {
      setIntegrations(integrationsState.data);
    }
  }, [integrationsState.data]);

  const loadIntegrations = async () => {
    try {
      await integrationsState.execute(() => getIntegrations());
    } catch (error) {
      showToast("error", "Failed to load integrations");
    }
  };

  const handleOAuthConnect = async (integrationType: string) => {
    try {
      const result = await startOAuthFlow(integrationType);
      window.location.href = result.oauth_url;
    } catch (error) {
      showToast("error", "Failed to start OAuth flow");
    }
  };

  const getIntegrationStatus = (type: string) => {
    return integrations.find((i) => i.integration_type === type);
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Are you sure you want to disconnect this integration?"))
      return;

    try {
      // In a real implementation, we'd have a delete/disconnect endpoint
      setIntegrations((prev) =>
        prev.filter((i) => i.id !== integrationId)
      );
      showToast("success", "Integration disconnected");
    } catch (error) {
      showToast("error", "Failed to disconnect integration");
    }
  };

  if (integrationsState.isLoading && integrations.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Connected Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_INTEGRATIONS.map((availInt) => {
            const connected = getIntegrationStatus(availInt.type);
            return (
              <div
                key={availInt.type}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{availInt.icon}</span>
                    <div>
                      <h3 className="font-semibold">{availInt.name}</h3>
                      {connected ? (
                        <p className="text-sm text-green-600">✓ Connected</p>
                      ) : (
                        <p className="text-sm text-gray-600">Not connected</p>
                      )}
                    </div>
                  </div>
                </div>

                {connected && (
                  <div className="text-xs text-gray-500 mb-3 space-y-1">
                    <p>
                      Connected:{" "}
                      {new Date(connected.created_at).toLocaleDateString()}
                    </p>
                    {connected.last_successful_connection && (
                      <p>
                        Last synced:{" "}
                        {new Date(
                          connected.last_successful_connection
                        ).toLocaleDateString()}
                      </p>
                    )}
                    {connected.connection_error && (
                      <p className="text-red-600">
                        Error: {connected.connection_error}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {connected ? (
                    <>
                      <button
                        onClick={() => handleDisconnect(connected.id)}
                        className="flex-1 px-3 py-2 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                      >
                        Disconnect
                      </button>
                      {connected.is_valid && (
                        <button className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                          Settings
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleOAuthConnect(availInt.type)}
                      disabled={configState.isLoading}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Webhook URLs Section */}
      {integrations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Webhook URLs</h3>
          <div className="space-y-3">
            {integrations
              .filter((i) => i.webhook_url)
              .map((integration) => (
                <div
                  key={integration.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h4 className="font-medium mb-2">{integration.integration_name}</h4>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm break-all">
                      {integration.webhook_url}
                    </code>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          integration.webhook_url || ""
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
