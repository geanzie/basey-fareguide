import type { ReactNode } from 'react'

/** Right-aligned row of small action buttons for list items (pair with Button size="sm"). */
export default function RowActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mt-3 flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
}
