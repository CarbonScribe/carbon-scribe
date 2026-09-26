'use client';

/**
 * Non-blocking, dismissible warning for the 'warning' session-expiry state
 * only (#549). This is one half of a deliberate two-component split:
 *
 *  - SessionExpiryBanner (this file): 'warning' state, no unsaved changes
 *    registered. A dismissible top-of-page strip — a user mid-task can
 *    hide it and keep working, because nothing is at risk of being lost
 *    yet (the token simply hasn't been silently auto-refreshed).
 *  - SessionTimeoutModal: the 'grace' state (access token has actually
 *    expired and auto-logout is imminent), and — un-dismissable — the
 *    'warning' state too whenever a form has registered unsaved changes
 *    via useUnsavedChangesRegistration. See that component's doc comment.
 *
 * Dismissing this banner only ever affects the 'warning' state's own
 * render; it cannot suppress the later grace-period modal, since that's a
 * separate component keyed off the same sessionExpiryState with its own,
 * always-reset UI state.
 */

import { useState, useRef } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AccessibleIcon } from '@/components/common/AccessibleIcon';
import { IconButton } from '@/components/common/IconButton';
import { useHasUnsavedChanges } from '@/lib/forms/unsavedChangesRegistry';

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
  const hasUnsavedChanges = useHasUnsavedChanges();
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewFailed, setRenewFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Reset dismissed state when expiry state changes
  if (sessionExpiryState !== 'warning' && dismissed) {
    setDismissed(false);
  }

  const isWarning = sessionExpiryState === 'warning';

  // Once a form has unsaved changes, SessionTimeoutModal takes over the
  // 'warning' state as a non-dismissable blocking modal — render nothing
  // here to avoid showing both a dismissible banner and a blocking modal
  // for the same state at once.
  if (!isWarning || dismissed || hasUnsavedChanges) return null;

  const handleRenew = async () => {
    setIsRenewing(true);
    setRenewFailed(false);
    const success = await renewSession();
    if (!success) setRenewFailed(true);
    setIsRenewing(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Return focus to the element that triggered the banner
    const triggerElement = document.activeElement as HTMLElement;
    if (triggerElement) {
      triggerElement.focus();
    }
  };

  const ariaLabel =
    'Session expiring soon. You will be logged out in ' + formatCountdown(secondsUntilExpiry) + '.';

  return (
    <div
      ref={bannerRef}
      role="alert"
      aria-live="polite"
      aria-label={ariaLabel}
      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-b focus:outline-none bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
      tabIndex={-1}
    >
      {/* Icon */}
      <AccessibleIcon hidden aria-hidden="true">
        <AlertTriangle size={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
      </AccessibleIcon>

      {/* Message */}
      <span className="flex-1">
        <span className="font-semibold">Session expiring soon.</span>{' '}
        You will be logged out in{' '}
        <span className="tabular-nums font-mono font-bold" aria-live="polite">
          {formatCountdown(secondsUntilExpiry)}
        </span>
        .
        {renewFailed && (
          <span className="ml-2 text-xs opacity-80" role="alert" aria-live="polite">
            (Renewal failed — please try again.)
          </span>
        )}
      </span>

      {/* Renew button */}
      <IconButton
        label={isRenewing ? 'Renewing session...' : 'Renew session'}
        onClick={handleRenew}
        disabled={isRenewing}
        className="shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white focus:ring-amber-500"
      >
        <AccessibleIcon hidden aria-hidden="true">
          <RefreshCw size={12} className={isRenewing ? 'animate-spin' : ''} />
        </AccessibleIcon>
        <span>{isRenewing ? 'Renewing…' : 'Renew Session'}</span>
        {isRenewing && <span className="sr-only">Please wait while your session is being renewed</span>}
      </IconButton>

      {/* Dismiss */}
      <IconButton
        label="Dismiss session warning"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        <AccessibleIcon hidden aria-hidden="true">
          <X size={14} />
        </AccessibleIcon>
        <span className="sr-only">Dismiss session expiry warning</span>
      </IconButton>
    </div>
  );
}