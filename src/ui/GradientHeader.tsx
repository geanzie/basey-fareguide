import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

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
 *
 * The right half is a photo of real Basey banig, the side the left-aligned
 * title leaves empty. Title text stops short of it. Controls passed as
 * children may sit on it, so they carry their own dark backing (see
 * BAND_PILL in components/operations/controls.tsx).
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
      className={`bg-brand relative rounded-b-band px-6 pb-10 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] text-white ${className}`}
    >
      <BanigField />
      <div className="relative">
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
          <div className="min-w-0 flex-1 pr-[30%] sm:pr-[45%]">
            <h1 className="break-words text-2xl font-extrabold">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-green-200">{subtitle}</p> : null}
          </div>
          {right ? <div className="ml-auto shrink-0">{right}</div> : null}
        </div>
      </div>
      <div className="relative">{children}</div>
    </header>
  )
}

// Solid over most of the half, with a short fade into the gradient at its
// left edge so the photo does not end on a hard seam.
const FIELD_MASK = 'linear-gradient(to left, #000 70%, transparent)'
const fieldMaskStyle: CSSProperties = { maskImage: FIELD_MASK, WebkitMaskImage: FIELD_MASK }

/**
 * A photo of real Basey banig mats (`public/brand/banig-mat.webp`, cropped to
 * the natural tikog mat's zigzags), covering the band's right half at full
 * height. Its own box carries the band's bottom radius, so the header itself
 * never needs `overflow-hidden`, which would clip whatever `right` renders.
 * 40% on phones, where half would squeeze the title into a narrow column.
 */
const BanigField = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-y-0 right-0 w-2/5 rounded-br-band bg-[url('/brand/banig-mat.webp')] bg-cover bg-center sm:w-1/2"
    style={fieldMaskStyle}
  />
)
