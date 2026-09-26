'use client'

import { ReactNode } from 'react'

interface AccessibleIconProps {
  children: ReactNode
  label?: string
  hidden?: boolean
  className?: string
  role?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

export function AccessibleIcon({
  children,
  label,
  hidden = false,
  className = '',
  role = 'img',
  'aria-hidden': ariaHidden,
}: AccessibleIconProps) {
  const isHidden = hidden || ariaHidden === true || ariaHidden === 'true'

  return (
    <span
      className={className}
      role={!isHidden ? role : undefined}
      aria-label={!isHidden ? label : undefined}
      aria-hidden={isHidden ? 'true' : undefined}
    >
      {children}
    </span>
  )
}