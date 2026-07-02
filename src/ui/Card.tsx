import type { HTMLAttributes } from 'react'

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Set false when the content manages its own padding (e.g. lists with dividers). */
  padded?: boolean
}

/** White surface card — mirrors mobile Card (radius 14, hairline border, soft shadow). */
export default function Card({ padded = true, className = '', children, ...rest }: Props) {
  return (
    <div
      className={`rounded-card border border-surface-border bg-surface shadow-card ${padded ? 'p-4' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
