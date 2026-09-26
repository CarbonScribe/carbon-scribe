'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

interface FocusManagementOptions {
  /** ID of the element to focus on mount */
  focusTargetId?: string
  /** Whether to restore focus on unmount */
  restoreFocus?: boolean
  /** Whether to trap focus within the container */
  trapFocus?: boolean
  /** Callback when focus is trapped */
  onFocusTrap?: () => void
}

/**
 * Hook for managing focus in components
 * Handles focus trapping, restoration, and navigation focus
 */
export function useFocusManagement({
  focusTargetId,
  restoreFocus = false,
  trapFocus = false,
  onFocusTrap,
}: FocusManagementOptions = {}) {
  const containerRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const pathname = usePathname()

  // Save previous focus on mount
  useEffect(() => {
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement
    }

    // Focus the target element
    if (focusTargetId) {
      const target = document.getElementById(focusTargetId)
      if (target) {
        setTimeout(() => {
          target.focus()
        }, 100)
      }
    }

    return () => {
      // Restore focus on unmount
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [focusTargetId, restoreFocus])

  // Focus trap
  useEffect(() => {
    if (!trapFocus || !containerRef.current) return

    const container = containerRef.current

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
        onFocusTrap?.()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
        onFocusTrap?.()
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [trapFocus, onFocusTrap])

  // Focus management on route change
  useEffect(() => {
    // Return focus to main content after navigation
    const mainContent = document.querySelector('main[role="main"]')
    if (mainContent && !document.activeElement?.closest('main')) {
      setTimeout(() => {
        mainContent.setAttribute('tabindex', '-1')
        ;(mainContent as HTMLElement).focus()
        mainContent.removeAttribute('tabindex')
      }, 100)
    }
  }, [pathname])

  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element
  }, [])

  return {
    containerRef: setContainerRef,
    focusElement: useCallback((element: HTMLElement | string) => {
      const target = typeof element === 'string' ? document.getElementById(element) : element
      if (target) {
        target.focus()
      }
    }, []),
  }
}