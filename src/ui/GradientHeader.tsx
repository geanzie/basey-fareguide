import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  /** Renders a back chevron linking here. */
  backHref?: string
  /** Optional element rendered on the right (e.g. an icon button). */
  right?: ReactNode
  /** Tighter vertical padding for content-heavy screens. */
  compact?: boolean
  /** Extra content rendered inside the band below the title (e.g. tabs, avatar). */
  children?: ReactNode
  className?: string
}

/**
 * Slate→green hero band — the web twin of mobile/src/ui/GradientHeader.tsx.
 * Extends the login screen's color story (#0f172a → #16a34a) so both apps read
 * as one brand. Float the first Card below it up with -mt-6 for depth.
 */
export default function GradientHeader({
  title,
  subtitle,
  backHref,
  right,
  compact,
  children,
  className = '',
}: Props) {
  return (
    // Bottom padding must exceed the content's -mt-6 float so cards overlap
    // only empty gradient, never the title/subtitle text.
    <header
      className={`bg-brand rounded-b-3xl px-6 pt-6 text-white ${compact ? 'pb-10' : 'pb-12'} ${className}`}
    >
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-extrabold">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[13px] text-green-200">{subtitle}</p> : null}
        </div>
        {right ? <div className="ml-auto shrink-0">{right}</div> : null}
      </div>
      {children}
    </header>
  )
}
