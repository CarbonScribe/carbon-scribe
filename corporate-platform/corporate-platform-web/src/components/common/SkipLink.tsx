'use client'

import { useEffect, useState } from 'react'

export function SkipLink() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsVisible(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const mainContent = document.querySelector('main[role="main"]')
    if (mainContent) {
      mainContent.setAttribute('tabindex', '-1')
      ;(mainContent as HTMLElement).focus()
      mainContent.removeAttribute('tabindex')
    }
  }

  if (!isVisible) return null

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-3 focus:bg-white dark:focus:bg-gray-800 focus:text-blue-600 dark:focus:text-blue-400 focus:border-2 focus:border-blue-500 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      Skip to main content
    </a>
  )
}