'use client';

/**
 * Blocking modal for imminent/actual session expiry (#549). This is the
 * second half of a deliberate two-component split with SessionExpiryBanner:
 *
 *  - SessionExpiryBanner: 'warning' state, no unsaved changes registered.
 *    A dismissible top-of-page strip a user can hide and keep working,
 *    since nothing is at risk of being lost yet.
 *  - SessionTimeoutModal (this file): the 'grace' state (the access token
 *    has actually expired and auto-logout is imminent — always blocking,
 *    never dismissable), and additionally the 'warning' state whenever
 *    useHasUnsavedChanges() reports a form has registered in-progress work
 *    via useUnsavedChangesRegistration — in that case the warning is
 *    promoted from a dismissible banner to this same blocking modal, so a
 *    user can't hide the countdown and lose unsaved input to a forced
 *    logout with no further prompt.
 *
 * Unlike the banner, this renders a full-screen overlay: no close button,
 * no dismiss-on-backdrop-click, no Escape-to-close — Escape renews the
 * session instead of dismissing the modal, and focus is trapped inside it
 * for the whole time it's open.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AccessibleIcon } from '@/components/common/AccessibleIcon';
import { IconButton } from '@/components/common/IconButton';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useHasUnsavedChanges } from '@/lib/forms/unsavedChangesRegistry';

function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export default function SessionTimeoutModal() {
  const { sessionExpiryState, secondsUntilExpiry, renewSession } = useAuth();
  const hasUnsavedChanges = useHasUnsavedChanges();
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewFailed, setRenewFailed] = useState(false);

  const isGrace = sessionExpiryState === 'grace';
  const isBlockingWarning = sessionExpiryState === 'warning' && hasUnsavedChanges;
  const isOpen = isGrace || isBlockingWarning;

  // Reset transient renew state whenever the modal closes (e.g. the user
  // renewed successfully, or the unsaved-changes flag cleared).
  useEffect(() => {
    if (!isOpen) {
      setIsRenewing(false);
      setRenewFailed(false);
    }
  }, [isOpen]);

  const { containerRef } = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    autoFocus: true,
  });

  const handleRenew = async () => {
    setIsRenewing(true);
    setRenewFailed(false);
    const success = await renewSession();
    if (!success) setRenewFailed(true);
    setIsRenewing(false);
  };

  // Escape renews rather than dismissing — this modal has no dismiss action.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleRenew();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = 'session-timeout-modal-title';
  const descriptionId = 'session-timeout-modal-description';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-md mx-4 rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 focus:outline-none"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={[
              'p-2 rounded-lg',
              isGrace ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
            ].join(' ')}
          >
            <AccessibleIcon hidden aria-hidden="true">
              {isGrace ? (
                <Clock size={20} className="text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
              )}
            </AccessibleIcon>
          </div>
          <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">
            {isGrace ? 'Session expired' : 'Session expiring soon'}
          </h2>
        </div>

        <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {isGrace ? (
            <>
              Your session has expired. You will be automatically signed out in{' '}
              <span className="tabular-nums font-mono font-bold text-red-600 dark:text-red-400" aria-live="assertive">
                {formatCountdown(secondsUntilExpiry)}
              </span>{' '}
              unless you renew now.
            </>
          ) : (
            <>
              You have unsaved changes on this page. Your session will expire in{' '}
              <span className="tabular-nums font-mono font-bold text-amber-600 dark:text-amber-400" aria-live="polite">
                {formatCountdown(secondsUntilExpiry)}
              </span>{' '}
              — renew now so your work isn&apos;t lost.
            </>
          )}
        </p>

        {renewFailed && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm"
          >
            <p className="font-semibold">
              Renewal failed. You will be logged out in {formatCountdown(secondsUntilExpiry)} — re-authenticate
              to continue.
            </p>
            <Link href="/login" className="underline font-medium hover:text-red-800 dark:hover:text-red-300">
              Go to login now
            </Link>
          </div>
        )}

        <IconButton
          label={isRenewing ? 'Renewing session...' : 'Renew session'}
          onClick={handleRenew}
          disabled={isRenewing}
          className={[
            'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:ring-2 focus:ring-offset-2',
            isGrace
              ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white focus:ring-red-500'
              : 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white focus:ring-amber-500',
          ].join(' ')}
        >
          <AccessibleIcon hidden aria-hidden="true">
            <RefreshCw size={14} className={isRenewing ? 'animate-spin' : ''} />
          </AccessibleIcon>
          <span>{isRenewing ? 'Renewing…' : 'Renew Session'}</span>
        </IconButton>

        <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
          Press Enter or Escape to renew now.
        </p>
      </div>
    </div>
  );
}
