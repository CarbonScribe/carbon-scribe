'use client'

import { useCallback, useEffect, useRef } from 'react'

interface KeyboardNavigationOptions {
  /** Items to navigate through */
  items: any[]
  /** Callback when an item is selected */
  onSelect?: (item: any, index: number) => void
  /** Callback when Escape is pressed */
  onEscape?: () => void
  /** Whether navigation is enabled */
  enabled?: boolean
  /** Initial selected index */
  initialIndex?: number
  /** Orientation of navigation (vertical or horizontal) */
  orientation?: 'vertical' | 'horizontal'
  /** Key to use for item identification */
  itemKey?: string
}

/**
 * Hook for keyboard navigation with arrow keys
 * Supports Up/Down or Left/Right navigation
 */
export function useKeyboardNavigation({
  items,
  onSelect,
  onEscape,
  enabled = true,
  initialIndex = -1,
  orientation = 'vertical',
  itemKey = 'id',
}: KeyboardNavigationOptions) {
  const selectedIndex = useRef(initialIndex)
  const containerRef = useRef<HTMLElement | null>(null)

  const navigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (!enabled || items.length === 0) return

      const currentIndex = selectedIndex.current
      let newIndex: number

      if (direction === 'next') {
        newIndex = currentIndex + 1
        if (newIndex >= items.length) {
          newIndex = 0 // Wrap around
        }
      } else {
        newIndex = currentIndex - 1
        if (newIndex < 0) {
          newIndex = items.length - 1 // Wrap around
        }
      }

      selectedIndex.current = newIndex

      // Focus the item
      const itemElement = containerRef.current?.querySelector(
        `[data-keyboard-index="${newIndex}"]`
      ) as HTMLElement

      if (itemElement) {
        itemElement.focus()
      }
    },
    [enabled, items.length]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      const isVertical = orientation === 'vertical'

      // Arrow navigation
      if (isVertical && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        navigate(e.key === 'ArrowDown' ? 'next' : 'prev')
        return
      }

      if (!isVertical && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        navigate(e.key === 'ArrowRight' ? 'next' : 'prev')
        return
      }

      // Home/End keys
      if (e.key === 'Home') {
        e.preventDefault()
        selectedIndex.current = 0
        const firstItem = containerRef.current?.querySelector(
          '[data-keyboard-index="0"]'
        ) as HTMLElement
        if (firstItem) firstItem.focus()
        return
      }

      if (e.key === 'End') {
        e.preventDefault()
        selectedIndex.current = items.length - 1
        const lastItem = containerRef.current?.querySelector(
          `[data-keyboard-index="${items.length - 1}"]`
        ) as HTMLElement
        if (lastItem) lastItem.focus()
        return
      }

      // Enter/Space for selection
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const currentIndex = selectedIndex.current
        if (currentIndex >= 0 && currentIndex < items.length) {
          onSelect?.(items[currentIndex], currentIndex)
        }
        return
      }

      // Escape for closing
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
    },
    [enabled, orientation, navigate, items, onSelect, onEscape]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])

  return {
    containerRef,
    selectedIndex: selectedIndex.current,
    setSelectedIndex: (index: number) => {
      selectedIndex.current = index
    },
    navigate,
    getItemProps: (index: number) => ({
      'data-keyboard-index': index,
      tabIndex: index === selectedIndex.current ? 0 : -1,
      role: orientation === 'vertical' ? 'menuitem' : 'tab',
    }),
  }
}