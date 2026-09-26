'use client'

import { useEffect, useRef } from 'react'

interface BadgeAnnouncerProps {
  count: number
  label: string
  'aria-live'?: 'polite' | 'assertive' | 'off'
}

export function BadgeAnnouncer({
  count,
  label,
  'aria-live': ariaLive = 'polite',
}: BadgeAnnouncerProps) {
  const previousCountRef = useRef(count)

  useEffect(() => {
    if (count !== previousCountRef.current) {
      previousCountRef.current = count
    }
  }, [count])

  return (
    <span
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
      className="sr-only"
    >
      {count > 0 ? `${label}: ${count}` : ''}
    </span>
  )
}