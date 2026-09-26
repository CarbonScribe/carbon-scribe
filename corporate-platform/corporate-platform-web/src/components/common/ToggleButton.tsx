'use client'

import { ReactNode } from 'react'

interface ToggleButtonProps {
  isExpanded: boolean
  onToggle: () => void
  label: string
  children: ReactNode
  controls?: string
  className?: string
  disabled?: boolean
  ariaLabelExpanded?: string
  ariaLabelCollapsed?: string
}

export function ToggleButton({
  isExpanded,
  onToggle,
  label,
  children,
  controls,
  className = '',
  disabled = false,
  ariaLabelExpanded,
  ariaLabelCollapsed,
}: ToggleButtonProps) {
  const ariaLabel = isExpanded
    ? ariaLabelExpanded || label
    : ariaLabelCollapsed || label

  return (
    <button
      onClick={onToggle}
      className={className}
      aria-label={ariaLabel}
      aria-expanded={isExpanded}
      aria-controls={controls}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  )
}