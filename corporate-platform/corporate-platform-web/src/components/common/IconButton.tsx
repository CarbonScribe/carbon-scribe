'use client'

import { ReactNode, forwardRef } from 'react'

interface IconButtonProps {
  children: ReactNode
  label: string
  onClick?: () => void
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  'aria-expanded'?: boolean
  'aria-controls'?: string
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  'aria-describedby'?: string
  'aria-pressed'?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  children,
  label,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
  'aria-expanded': ariaExpanded,
  'aria-controls': ariaControls,
  'aria-haspopup': ariaHaspopup,
  'aria-describedby': ariaDescribedby,
  'aria-pressed': ariaPressed,
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      className={className}
      disabled={disabled}
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-haspopup={ariaHaspopup}
      aria-describedby={ariaDescribedby}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  )
})