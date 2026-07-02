import type { ComponentType, ReactNode } from 'react'

interface Props {
  /** A lucide-react icon component. */
  icon: ComponentType<{ className?: string }>
  title: string
  message?: string
  /** Optional CTA (e.g. a retry Button or a Link). */
  action?: ReactNode
}

/** Centered empty/zero-data state with an icon chip and optional CTA. */
export default function EmptyState({ icon: Icon, title, message, action }: Props) {
  return (
    <div className="flex flex-col items-center px-6 pt-14 text-center">
      <div className="mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface-tint">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-base font-bold text-ink-strong">{title}</h3>
      {message ? <p className="mt-1 max-w-sm text-[13px] leading-5 text-ink-muted">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
