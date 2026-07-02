'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Password field with a show/hide eye toggle, styled on the shared field tokens.
 * `!pr-10` keeps the eye button clear of the value regardless of caller padding.
 */
export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={`w-full rounded-xl border border-surface-border bg-surface px-3 py-3 text-sm text-ink-strong placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-surface-alt disabled:text-ink-muted ${className} !pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint transition-colors hover:text-ink-body"
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
