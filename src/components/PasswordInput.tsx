'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Password field with a show/hide eye toggle for verification.
 * Forwards all standard input props; the caller's `className` styles the input.
 * `!pr-10` is forced so the eye button never overlaps the value regardless of
 * the caller's padding classes.
 */
export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} !pr-10`} />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600"
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  )
}
