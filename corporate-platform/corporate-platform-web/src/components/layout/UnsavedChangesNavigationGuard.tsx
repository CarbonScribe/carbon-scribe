'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasUnsavedChanges } from '@/lib/forms/unsavedChangesRegistry';
import {
  requestUnsavedChangesNavigation,
  subscribeToUnsavedNavigation,
} from '@/lib/forms/unsavedChangesNavigation';

export default function UnsavedChangesNavigationGuard() {
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const leaveButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return subscribeToUnsavedNavigation((navigate) => {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setPendingNavigation(() => navigate);
    });
  }, []);

  useEffect(() => {
    if (!pendingNavigation) return;

    stayButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPendingNavigation(null);
      } else if (event.key === 'Tab') {
        const firstButton = stayButtonRef.current;
        const lastButton = leaveButtonRef.current;
        if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton?.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingNavigation]);

  useEffect(() => {
    if (pendingNavigation) return;
    returnFocusRef.current?.focus();
  }, [pendingNavigation]);

  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (
        !anchor ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        (destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash === window.location.hash) ||
        !hasUnsavedChanges()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const href = `${destination.pathname}${destination.search}${destination.hash}`;
      requestUnsavedChangesNavigation(() => router.push(href));
    };

    document.addEventListener('click', handleLinkClick, true);
    return () => document.removeEventListener('click', handleLinkClick, true);
  }, [router]);

  if (!pendingNavigation) return null;

  function stayOnPage() {
    setPendingNavigation(null);
  }

  function leavePage() {
    const navigate = pendingNavigation;
    setPendingNavigation(null);
    navigate?.();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900"
      >
        <h2 id="unsaved-changes-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          Leave without saving?
        </h2>
        <p id="unsaved-changes-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          You have unsaved changes. If you leave this page, your changes will be lost.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={stayButtonRef}
            type="button"
            onClick={stayOnPage}
            className="corporate-btn-secondary px-4 py-2"
          >
            Stay on page
          </button>
          <button
            ref={leaveButtonRef}
            type="button"
            onClick={leavePage}
            className="corporate-btn-primary px-4 py-2"
          >
            Leave without saving
          </button>
        </div>
      </section>
    </div>
  );
}
