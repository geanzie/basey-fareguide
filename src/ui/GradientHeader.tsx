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
  /** Extra content rendered inside the band below the title (e.g. tabs, avatar). */
  children?: ReactNode
  className?: string
}

/**
 * Slate→green hero band — the web twin of mobile/src/ui/GradientHeader.tsx.
 * Extends the login screen's color story (#0f172a → #16a34a) so both apps read
 * as one brand.
 *
 * The band never floats page content itself. ui/PageShell owns the overlap: it
 * pulls an opaque `rounded-t-plate` surface up over the band's bottom padding,
 * so a page's first child is safe whether or not it happens to be a card.
 */
export default function GradientHeader({
  title,
  subtitle,
  backHref,
  right,
  children,
  className = '',
}: Props) {
  return (
    <header
      // pt clears the status bar in the standalone PWA (viewportFit: 'cover').
      className={`bg-brand rounded-b-band px-6 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] text-white ${className}`}
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
