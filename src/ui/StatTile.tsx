import Link from 'next/link'
import type { ComponentType } from 'react'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
} from '@/components/dashboardIcons'
import { TONE_HEX, TONE_TEXT_CLASSES, type Tone } from './theme'

interface Props {
  label: string
  value: string | number
  /** A lucide-react icon component. */
  icon?: ComponentType<{ className?: string }>
  /** Accent tone for icon + value. Defaults to success (primary green). */
  tone?: Tone
  /**
   * Makes the tile a link to a view filtered to *this* number.
   *
   * Only pass it when such a view actually exists. A tile that promises a
   * filtered list and lands on an unfiltered one is worse than a tile that
   * stays put, and the arrow is the app's only signal for "this navigates" —
   * spending it on a half-truth costs every other tile its meaning.
   */
  href?: string
  /** A short qualifier under the value, e.g. 'Cleanup recommended'. */
  detail?: string
}

const SHELL = 'flex flex-col gap-1 rounded-card border border-surface-border bg-surface p-4 shadow-card'

/** Compact metric tile. Designed for grid-cols-2 lg:grid-cols-4 grids. */
export default function StatTile({ label, value, icon: Icon, tone = 'success', href, detail }: Props) {
  const body = (
    <>
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
      <div className="flex items-center gap-1 text-xs font-semibold leading-tight text-ink-muted">
        <span className="min-w-0 flex-1">
          {label}
          {detail ? <span className="mt-0.5 block font-medium text-danger">{detail}</span> : null}
        </span>
        {href ? (
          <DashboardIconSlot
            icon={DASHBOARD_ICONS.arrowRight}
            size={DASHBOARD_ICON_POLICY.sizes.button}
            className="text-ink-faint transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
          />
        ) : null}
      </div>
    </>
  )

  if (!href) {
    return <div className={SHELL}>{body}</div>
  }

  return (
    <Link
      href={href}
      className={`group ${SHELL} transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none`}
    >
      {body}
    </Link>
  )
}
