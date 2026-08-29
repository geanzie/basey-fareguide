'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

// Variant colors mirror mobile/src/ui/Button.tsx (danger = soft red, ghost = blue text)
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  success: 'bg-primary text-white hover:bg-primary-dark',
  danger: 'bg-danger-soft text-danger border border-danger-softBorder hover:bg-red-100',
  secondary: 'bg-surface-alt text-ink-body border border-surface-border hover:bg-surface-bg',
  ghost: 'bg-transparent text-info hover:bg-info/5',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${isDisabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})

export default Button
