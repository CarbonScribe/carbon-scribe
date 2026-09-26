import { useCallback, useMemo } from 'react'

interface AccessibilityLabels {
  toggleSidebar: string
  toggleTheme: string
  openCart: string
  viewNotifications: string
  openSettings: string
  toggleNavigation: string
  searchCredits: string
  logout: string
  backToCart: string
  removeItem: string
  closeCart: string
}

export function useAccessibility() {
  const labels = useMemo<AccessibilityLabels>(() => ({
    toggleSidebar: 'Toggle sidebar',
    toggleTheme: 'Toggle theme',
    openCart: 'Open cart ({count} items)',
    viewNotifications: 'View notifications',
    openSettings: 'Open settings',
    toggleNavigation: 'Toggle navigation menu',
    searchCredits: 'Search credits, projects, or analytics...',
    logout: 'Logout',
    backToCart: 'Back to cart',
    removeItem: 'Remove {itemName}',
    closeCart: 'Close cart',
  }), [])

  const getCartLabel = useCallback((count: number): string => {
    return labels.openCart.replace('{count}', count.toString())
  }, [labels.openCart])

  const getRemoveItemLabel = useCallback((itemName: string): string => {
    return labels.removeItem.replace('{itemName}', itemName)
  }, [labels.removeItem])

  return {
    labels,
    getCartLabel,
    getRemoveItemLabel,
  }
}