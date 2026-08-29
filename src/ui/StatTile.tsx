import type { ComponentType } from 'react'
import { TONE_HEX, TONE_TEXT_CLASSES, type Tone } from './theme'

interface Props {
  label: string
  value: string | number
  /** A lucide-react icon component. */
  icon?: ComponentType<{ className?: string }>
  /** Accent tone for icon + value. Defaults to success (primary green). */
  tone?: Tone
}

/** Compact metric tile. Designed for grid-cols-2 lg:grid-cols-4 grids. */
export default function StatTile({ label, value, icon: Icon, tone = 'success' }: Props) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-surface-border bg-surface p-4 shadow-card">
      {Icon ? (
        <span
          className="mb-1 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
          // ponytail: translucent tone chip needs runtime hex — the one sanctioned inline-style spot (see ui/theme.ts)
          style={{ backgroundColor: TONE_HEX[tone] + '1a' }}
        >
          <Icon className={`h-[18px] w-[18px] ${TONE_TEXT_CLASSES[tone]}`} />
        </span>
      ) : null}
      <div className={`text-xl font-extrabold ${TONE_TEXT_CLASSES[tone]}`}>{value}</div>
      <div className="text-xs font-semibold leading-tight text-ink-muted">{label}</div>
    </div>
  )
}
