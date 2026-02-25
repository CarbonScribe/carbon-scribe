'use client';

import { useEffect } from 'react';
import { Link, Zap, Webhook, Bell, Activity, Plus } from 'lucide-react';
import { useIntegrationStore } from '@/store/integrationSlice';
import { useActiveConnections, useActiveWebhooks, useActiveSubscriptions, useOverallHealthStatus } from '@/store/integration.selectors';

const IntegrationsOverview = () => {
  const {
    connections,
    webhooks,
    subscriptions,
    healthMetrics,
    connectionsLoading,
    webhooksLoading,
    subscriptionsLoading,
    healthLoading,
    fetchConnections,
    fetchWebhooks,
    fetchSubscriptions,
    fetchHealthMetrics,
  } = useIntegrationStore();

  useEffect(() => {
    fetchConnections();
    fetchWebhooks();
    fetchSubscriptions();
    fetchHealthMetrics();
  }, [fetchConnections, fetchWebhooks, fetchSubscriptions, fetchHealthMetrics]);

  const activeConnections = useActiveConnections();
  const activeWebhooks = useActiveWebhooks();
  const activeSubscriptions = useActiveSubscriptions();
  const overallHealth = useOverallHealthStatus();

  const overviewItems = [
    {
      icon: Link,
      label: 'Active Connections',
      value: activeConnections.length,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/integrations/connections',
    },
    {
      icon: Webhook,
      label: 'Active Webhooks',
      value: activeWebhooks.length,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      href: '/integrations/webhooks',
    },
    {
      icon: Bell,
      label: 'Active Subscriptions',
      value: activeSubscriptions.length,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      href: '/integrations/subscriptions',
    },
    {
      icon: Activity,
      label: 'System Health',
      value: overallHealth === 'healthy' ? 'Good' : overallHealth === 'degraded' ? 'Issues' : 'Down',
      color: overallHealth === 'healthy' ? 'text-green-600' : overallHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600',
      bg: overallHealth === 'healthy' ? 'bg-green-50' : overallHealth === 'degraded' ? 'bg-yellow-50' : 'bg-red-50',
      href: '/integrations/health',
    },
  ];

  const isLoading = connectionsLoading || webhooksLoading || subscriptionsLoading || healthLoading;

  if (isLoading && connections.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-10 w-32 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center p-4 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-gray-200 mx-auto mb-3" />
              <div className="h-7 w-16 bg-gray-200 rounded mx-auto mb-1" />
              <div className="h-4 w-20 bg-gray-200 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Integration Hub</h2>
        <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          New Connection
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {overviewItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="block text-center p-4 rounded-xl hover:scale-105 transition-transform duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className={`inline-flex p-3 rounded-full ${item.bg} ${item.color} mb-3`}>
              <item.icon className="w-6 h-6" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{item.value}</div>
            <div className="text-sm text-gray-600 mt-1">{item.label}</div>
          </a>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {activeConnections.slice(0, 3).map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <Link className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{conn.name}</p>
                  <p className="text-sm text-gray-600">{conn.provider}</p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${
                conn.status === 'active' ? 'bg-green-100 text-green-800' :
                conn.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {conn.status}
              </span>
            </div>
          ))}
          {activeConnections.length === 0 && (
            <p className="text-gray-500 text-center py-4">No active connections yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsOverview;
