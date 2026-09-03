import type { ReactNode } from 'react'
import GradientHeader from './GradientHeader'

interface Props {
  title: string
  subtitle?: string
  /** Renders a back chevron in the band linking here. */
  backHref?: string
  /** Optional element rendered on the right of the band (e.g. an icon button). */
  right?: ReactNode
  /** Extra content rendered inside the band below the title (e.g. tabs). */
  band?: ReactNode
  /**
   * Content column width. 'wide' (default) suits dashboards and tables,
   * 'narrow' long-form reading. The band matches it, so the header never spans
   * wider than what's under it.
   *
   * There is deliberately no narrower option. A single focused input column is
   * a property of the *controls*, not of the page: give the form its own
   * max-width inside the plate. Sizing the band down to a form made
   * /calculator's green header half the width of every other page's on
   * desktop, which is the whole reason this variant is gone.
   */
  width?: 'wide' | 'narrow'
  children: ReactNode
}

/**
 * The standard authenticated page frame: brand band, then page content on an
 * opaque plate floated up over the band's bottom edge.
 *
 * The plate is the point. Pages used to hand-write `-mt-6 px-4 pb-8 lg:px-8`
 * under the band, which only looked right when the page's first child was a
 * card — a bare heading or toolbar landed dark-on-gradient instead. The plate
 * carries `bg-surface-bg`, so content always starts on the app background.
 *
 * Its 20px top radius is 4px tighter than the band's 24px bottom radius (the
 * 6px it is floated up by, minus the 2px of band edge left visible), so the
 * plate reads as sitting in front of the band rather than notched into it.
 */
const PAGE_WIDTHS = {
  wide: 'max-w-6xl',
  narrow: 'max-w-4xl',
} as const

export default function PageShell({
  title,
  subtitle,
  backHref,
  right,
  band,
  width = 'wide',
  children,
}: Props) {
  return (
    <div className={`mx-auto w-full ${PAGE_WIDTHS[width]}`}>
      <GradientHeader title={title} subtitle={subtitle} backHref={backHref} right={right}>
        {band}
      </GradientHeader>
      <div className="-mt-6 rounded-t-plate bg-surface-bg px-4 pb-8 pt-5 lg:px-8">{children}</div>
    </div>
  )
}
