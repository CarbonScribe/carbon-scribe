'use client';

import { useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import { useConnectivity, type ConnectionStatus } from '@/contexts/ConnectivityContext';
import { requestQueue } from '@/lib/utils/requestQueue';

/**
 * Connection Status Indicator Component
 * Displays current connectivity state with visual indicators and details
 */
export default function ConnectionStatus() {
  const { state, retryPendingOperations } = useConnectivity();
  const [showDetails, setShowDetails] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const queueState = requestQueue.getState();

  const getStatusConfig = () => {
    switch (state.status) {
      case 'online':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          text: 'Connected',
        };
      case 'degraded':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          text: 'Limited Connectivity',
        };
      case 'offline':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          text: 'Offline',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryPendingOperations();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="relative">
      {/* Status Indicator Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.borderColor} ${config.color} hover:opacity-80 transition-opacity`}
        title="Click for connection details"
      >
        <Icon size={16} />
        <span className="text-sm font-medium">{config.text}</span>
        {queueState.totalQueued > 0 && (
          <span className="bg-current text-white text-xs px-1.5 py-0.5 rounded-full">
            {queueState.totalQueued}
          </span>
        )}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className={`absolute bottom-full right-0 mb-2 w-72 rounded-lg border shadow-lg p-4 ${config.bgColor} ${config.borderColor} z-50`}>
          <div className="space-y-3">
            {/* Status Header */}
            <div className="flex items-center gap-2">
              <Icon size={20} className={config.color} />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{config.text}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {state.isOnline ? 'Network available' : 'No network connection'}
                </p>
              </div>
            </div>

            {/* Last Successful API Call */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock size={14} />
              <span>Last successful API call: {formatTimeAgo(state.lastSuccessfulApiCall)}</span>
            </div>

            {/* Pending Operations */}
            {queueState.totalQueued > 0 && (
              <div className="pt-2 border-t border-current/20">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Pending Operations
                </p>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Queued:</span>
                    <span className="font-medium">{queueState.totalQueued}</span>
                  </div>
                  {queueState.totalProcessed > 0 && (
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{queueState.totalProcessed}</span>
                    </div>
                  )}
                  {queueState.totalFailed > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Failed:</span>
                      <span className="font-medium">{queueState.totalFailed}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying || state.status === 'offline'}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-current text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                  <span>{isRetrying ? 'Retrying...' : 'Retry Pending'}</span>
                </button>
              </div>
            )}

            {/* Degraded State Info */}
            {state.status === 'degraded' && (
              <div className="pt-2 border-t border-current/20 text-sm text-gray-600 dark:text-gray-400">
                <p>Some requests are failing or timing out. Your data may be stale.</p>
              </div>
            )}

            {/* Offline State Info */}
            {state.status === 'offline' && (
              <div className="pt-2 border-t border-current/20 text-sm text-gray-600 dark:text-gray-400">
                <p>You are offline. Writes will be queued and retried when you reconnect.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version of ConnectionStatus for use in tight spaces
 */
export function CompactConnectionStatus() {
  const { state } = useConnectivity();
  const queueState = requestQueue.getState();

  const getStatusColor = () => {
    switch (state.status) {
      case 'online':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${state.status === 'offline' ? 'animate-pulse' : ''}`} />
      {queueState.totalQueued > 0 && (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {queueState.totalQueued} pending
        </span>
      )}
    </div>
  );
}
