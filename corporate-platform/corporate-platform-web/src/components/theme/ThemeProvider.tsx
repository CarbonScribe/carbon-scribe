'use client'

import * as React from 'react'
import { useHydrated } from '@/hooks/useHydrated'

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
  enableSystem = true,
  disableTransitionOnChange = false
}: ThemeProviderProps) {
  // Use hydration-safe flag to prevent client/server mismatches
  const isHydrated = useHydrated()

  // Store theme in state with hydration-safe initial value
  const [theme, setTheme] = React.useState(defaultTheme)
  const [isClient, setIsClient] = React.useState(false)

  // This effect runs only on the client after hydration
  React.useEffect(() => {
    setIsClient(true)

    // Check for saved theme or system preference
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    let initialTheme = defaultTheme
    if (savedTheme === 'dark' || savedTheme === 'light') {
      initialTheme = savedTheme
    } else if (enableSystem && prefersDark) {
      initialTheme = 'dark'
    }

    setTheme(initialTheme)

    // Apply theme class
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    }
    document.documentElement.style.colorScheme = initialTheme

    // Handle system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light'
        setTheme(newTheme)
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark')
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.documentElement.classList.remove('dark')
          document.documentElement.setAttribute('data-theme', 'light')
        }
        document.documentElement.style.colorScheme = newTheme
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    // Disable transitions if configured
    if (disableTransitionOnChange) {
      const css = document.createElement('style')
      css.textContent = `
        * {
          transition: none !important;
        }
      `
      document.head.appendChild(css)

      // Force reflow
      document.body.offsetHeight

      setTimeout(() => {
        if (document.head.contains(css)) {
          document.head.removeChild(css)
        }
      }, 1)
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [defaultTheme, enableSystem, disableTransitionOnChange])

  const value = React.useMemo(() => ({
    theme,
    setTheme: (newTheme: string) => {
      setTheme(newTheme)
      localStorage.setItem('theme', newTheme)
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark')
        document.documentElement.setAttribute('data-theme', 'dark')
        document.documentElement.style.colorScheme = 'dark'
      } else if (newTheme === 'light') {
        document.documentElement.classList.remove('dark')
        document.documentElement.setAttribute('data-theme', 'light')
        document.documentElement.style.colorScheme = 'light'
      } else {
        // System theme
        localStorage.removeItem('theme')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          document.documentElement.classList.add('dark')
          document.documentElement.setAttribute('data-theme', 'dark')
          document.documentElement.style.colorScheme = 'dark'
        } else {
          document.documentElement.classList.remove('dark')
          document.documentElement.setAttribute('data-theme', 'light')
          document.documentElement.style.colorScheme = 'light'
        }
      }
    },
  }), [theme])

  // During server rendering or before hydration, render children without theme wrapper
  // to prevent hydration mismatches. The theme will be applied after hydration.
  if (!isHydrated) {
    return <>{children}</>
  }

  // After hydration, render with theme context
  return (
    <div
      data-theme={theme}
      className={attribute === 'class' ? theme : ''}
      // Suppress hydration warnings for dynamic content
      suppressHydrationWarning
    >
      {children}
    </div>
  )
}