'use client';

import { AlertTriangle, AlertCircle, Info, RefreshCw, ExternalLink, HelpCircle } from 'lucide-react';
import type { ActionableError } from '@/lib/utils/errorHandler';

interface ActionableErrorProps {
  error: ActionableError;
  onRetry?: () => void;
  className?: string;
}

export default function ActionableError({ error, onRetry, className = '' }: ActionableErrorProps) {
  const severityIcon = {
    critical: <AlertCircle className="w-6 h-6 text-red-600" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
  };

  const severityBg = {
    critical: 'bg-red-50 border-red-200',
    error: 'bg-red-50/50 border-red-100',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const retryAction = onRetry || error.retryAction;

  return (
    <div
      className={`rounded-xl border p-6 ${severityBg[error.severity]} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          {severityIcon[error.severity]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Error Message */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {error.message}
          </h3>

          {/* Description */}
          {error.description && (
            <p className="text-sm text-gray-700 mb-3">
              {error.description}
            </p>
          )}

          {/* Error Code & Status */}
          {(error.errorCode || error.statusCode) && (
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
              {error.errorCode && (
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {error.errorCode}
                </span>
              )}
              {error.statusCode && (
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  HTTP {error.statusCode}
                </span>
              )}
            </div>
          )}

          {/* Troubleshooting Tip */}
          {error.troubleshootingTip && (
            <div className="bg-white/70 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1">
                    Troubleshooting Tip:
                  </p>
                  <p className="text-sm text-gray-600">
                    {error.troubleshootingTip}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Retry Button */}
            {retryAction && error.retryable && (
              <button
                onClick={retryAction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Retry the failed action"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}

            {/* Support Link */}
            {error.supportLink && (
              <a
                href={error.supportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Get help from support"
              >
                <ExternalLink className="w-4 h-4" />
                Get Help
              </a>
            )}

            {/* Documentation Link */}
            {error.documentationLink && (
              <a
                href={error.documentationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                aria-label="View documentation"
              >
                <ExternalLink className="w-3 h-3" />
                View Documentation
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
