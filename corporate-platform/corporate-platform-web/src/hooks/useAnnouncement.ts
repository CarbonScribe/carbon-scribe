import { useCallback, useEffect, useRef } from 'react'

export type AnnouncementPriority = 'polite' | 'assertive'

const regions: Record<AnnouncementPriority, HTMLDivElement | null> = {
  polite: null,
  assertive: null,
}

function createRegion(priority: AnnouncementPriority): HTMLDivElement {
  const region = document.createElement('div')
  region.setAttribute('aria-live', priority)
  region.setAttribute('aria-atomic', 'true')
  region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status')
  region.style.position = 'absolute'
  region.style.width = '1px'
  region.style.height = '1px'
  region.style.margin = '-1px'
  region.style.overflow = 'hidden'
  region.style.clip = 'rect(0, 0, 0, 0)'
  region.style.whiteSpace = 'nowrap'
  document.body.appendChild(region)
  return region
}

function getRegion(priority: AnnouncementPriority): HTMLDivElement {
  const existing = regions[priority]
  if (existing) return existing
  const region = createRegion(priority)
  regions[priority] = region
  return region
}

export function useAnnouncement() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    if (typeof document === 'undefined') return

    const region = getRegion(priority)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Clear first so repeated identical messages are re-announced by screen readers.
    region.textContent = ''
    timeoutRef.current = setTimeout(() => {
      region.textContent = message
    }, 50)
  }, [])

  return { announce }
}
