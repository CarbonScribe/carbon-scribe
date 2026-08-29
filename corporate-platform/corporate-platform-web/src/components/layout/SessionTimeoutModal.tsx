'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useFocusTrap } from '@/hooks/useFocusTrap'

function formatCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, '0')}s`
}

/**
 * Blocking grace-period UI. SessionExpiryBanner remains the non-blocking
 * warning-state notification; this modal prevents silent loss of work once
 * the access token has expired and the logout grace period starts.
 */
export default function SessionTimeoutModal() {
  const { sessionExpiryState, secondsUntilExpiry, renewSession } = useAuth()
  const [renewing, setRenewing] = useState(false)
  const [renewFailed, setRenewFailed] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const isOpen = sessionExpiryState === 'grace'
  const { containerRef } = useFocusTrap({ active: isOpen, autoFocus: true })

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void renew()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  if (!isOpen) return null

  async function renew() {
    if (renewing) return
    setRenewing(true)
    setRenewFailed(false)
    const success = await renewSession()
    if (!success) setRenewFailed(true)
    setRenewing(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        ref={(element) => {
          dialogRef.current = element
          containerRef.current = element
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-description"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900"
      >
        <h2 id="session-timeout-title" className="text-xl font-semibold text-slate-900 dark:text-white">
          Your session has expired
        </h2>
        <p id="session-timeout-description" className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          You will be signed out in <strong>{formatCountdown(secondsUntilExpiry)}</strong>. Renew now to keep your work safe.
        </p>
        {renewFailed && (
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
            Renewal failed. Re-authenticate now to avoid losing your work.
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 underline dark:text-slate-300">
            Re-authenticate
          </Link>
          <button
            type="button"
            onClick={() => void renew()}
            disabled={renewing}
            className="inline-flex items-center gap-2 rounded-md bg-corporate-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <RefreshCw size={15} className={renewing ? 'animate-spin' : ''} />
            {renewing ? 'Renewing…' : 'Stay signed in'}
          </button>
        </div>
      </div>
    </div>
  )
}
