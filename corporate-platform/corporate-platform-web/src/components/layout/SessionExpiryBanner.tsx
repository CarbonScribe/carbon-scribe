'use client';

import { useState } from 'react';
import { AlertTriangle, Clock, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export default function SessionExpiryBanner() {
  const { sessionExpiryState, secondsUntilExpiry, renewSession } = useAuth();
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewFailed, setRenewFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when expiry state changes
  if (sessionExpiryState === 'active' && dismissed) {
    setDismissed(false);
  }

  // Grace period is non-dismissable; warning can be dismissed
  const isGrace = sessionExpiryState === 'grace';
  const isWarning = sessionExpiryState === 'warning';

  if (sessionExpiryState === 'active' || sessionExpiryState === 'expired') return null;
  if (isWarning && dismissed) return null;

  const handleRenew = async () => {
    setIsRenewing(true);
    setRenewFailed(false);
    const success = await renewSession();
    if (!success) setRenewFailed(true);
    setIsRenewing(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-b',
        isGrace
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
      ].join(' ')}
    >
      {/* Icon */}
      {isGrace ? (
        <Clock size={16} className="shrink-0 text-red-500 dark:text-red-400" />
      ) : (
        <AlertTriangle size={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
      )}

      {/* Message */}
      <span className="flex-1">
        {isGrace ? (
          <>
            <span className="font-semibold">Session expired.</span>{' '}
            Auto-logout in{' '}
            <span className="tabular-nums font-mono font-bold">
              {formatCountdown(secondsUntilExpiry)}
            </span>
            {' '}— renew now to stay signed in.
          </>
        ) : (
          <>
            <span className="font-semibold">Session expiring soon.</span>{' '}
            You will be logged out in{' '}
            <span className="tabular-nums font-mono font-bold">
              {formatCountdown(secondsUntilExpiry)}
            </span>
            .
          </>
        )}
        {renewFailed && (
          <span className="ml-2 text-xs opacity-80">
            (Renewal failed — please try again.)
          </span>
        )}
      </span>

      {/* Renew button */}
      <button
        onClick={handleRenew}
        disabled={isRenewing}
        className={[
          'shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors',
          isGrace
            ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white'
            : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white',
        ].join(' ')}
      >
        <RefreshCw size={12} className={isRenewing ? 'animate-spin' : ''} />
        {isRenewing ? 'Renewing…' : 'Renew Session'}
      </button>

      {/* Dismiss (warning only) */}
      {isWarning && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss session warning"
          className="shrink-0 rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
