import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const CONTROL_CLASSES =
  'w-full rounded-xl border border-surface-border bg-surface px-3 py-3 text-sm text-ink-strong placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-surface-alt disabled:text-ink-muted'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

/** Labeled form field wrapper: label + control + hint/error line. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink-body">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`${CONTROL_CLASSES} ${className}`} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${CONTROL_CLASSES} ${className}`} {...rest}>
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return <textarea ref={ref} className={`${CONTROL_CLASSES} min-h-[96px] ${className}`} {...rest} />
  },
)
