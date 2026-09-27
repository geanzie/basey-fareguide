import type { ReactNode } from 'react'

import BrandMark from '@/components/BrandMark'

interface AuthShellProps {
  title: string
  /** One line under the title, e.g. what this step needs from the user. */
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * Shared frame for every sign-in, sign-up and password-reset screen: forest
 * brand panel and banig seam, then the form on white. Panel on top with a
 * horizontal seam on phones; an even 50/50 split with a vertical seam on
 * `lg`, where the brand side stays put while a long form scrolls. The form
 * column is one fixed width on every screen, so switching between sign-in,
 * sign-up and reset never shifts the fields.
 */
const AuthShell = ({ title, subtitle, children }: AuthShellProps) => (
  <div className="flex flex-1 flex-col bg-surface lg:flex-row">
    <div className="flex flex-col lg:h-dvh lg:w-1/2 lg:shrink-0 lg:flex-row">
      <BrandPanel />
      <WeaveSeam />
    </div>

    {/* On lg this column scrolls by itself with its scrollbar gutter always
        reserved, so a long form's scrollbar never nudges the fields sideways. */}
    <div className="flex flex-1 justify-center px-6 pb-10 pt-7 lg:h-dvh lg:overflow-y-auto lg:px-12 lg:py-8 lg:[scrollbar-gutter:stable]">
      <div className="w-full max-w-md lg:my-auto">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-ink-strong lg:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  </div>
)

/**
 * Brand half: a compact header on phones, the whole left side on desktop.
 * The line at the bottom stands in for the site footer, which auth screens hide.
 */
const BrandPanel = () => (
  <aside className="flex bg-[#14532D] px-6 pb-7 pt-6 text-white lg:flex-1 lg:px-14 lg:py-10">
    {/* Below lg this column lines up with the centered form underneath it. */}
    <div className="mx-auto flex w-full max-w-md flex-col lg:mx-0 lg:max-w-none lg:justify-between">
      <div className="flex items-center gap-3">
        <BrandMark size="md" tone="dark" />
        <h1 className="font-brand text-xl font-extrabold">Basey FareCheck</h1>
      </div>

      <div className="mt-7 max-w-xl lg:mt-0">
        <p className="font-brand text-3xl font-extrabold leading-[1.05] text-balance text-[#F3E6C4] sm:text-4xl lg:text-5xl xl:text-6xl">
          Know the fare before you ride.
        </p>
        <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-white/75 sm:block lg:mt-6 lg:text-base">
          Official fares for every tricycle and habal-habal in
          Basey, set by Municipal Ordinance 105, Series of 2023.
        </p>
      </div>

      <p className="hidden text-sm text-white/60 lg:block">
        &copy; 2025 Municipality of Basey, Samar, Philippines
      </p>
    </div>
  </aside>
)

// The logo's banig: stepped chevron bands of indigo, marigold, coral and
// turquoise, with a row of natural tikog between each repeat.
const BANIG_BANDS = ['#4B2E83', '#F39A2B', '#EE6A55', '#37B7C3', '#E6D3A8']
const WEAVE_CELL = 2

// One 6×5 cell repeat; its 6 cells across fill the 12px strip. Chevrons
// point along the strip: along x when horizontal, along y when vertical.
const weaveCells = (vertical: boolean) =>
  Array.from({ length: 30 }, (_, i) => {
    const across = i % 6
    const along = Math.floor(i / 6)
    const band = BANIG_BANDS[(along + Math.floor(Math.abs(across - 2.5))) % 5]
    const [x, y] = vertical ? [across, along] : [along, across]
    return (
      <rect
        key={i}
        x={x * WEAVE_CELL}
        y={y * WEAVE_CELL}
        width={WEAVE_CELL}
        height={WEAVE_CELL}
        fill={band}
      />
    )
  })

const WeaveStrip = ({ vertical, className }: { vertical: boolean; className: string }) => {
  const id = vertical ? 'auth-weave-v' : 'auth-weave-h'
  return (
    <svg aria-hidden="true" className={className}>
      <defs>
        <pattern
          id={id}
          width={(vertical ? 6 : 5) * WEAVE_CELL}
          height={(vertical ? 5 : 6) * WEAVE_CELL}
          patternUnits="userSpaceOnUse"
        >
          {weaveCells(vertical)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * The banig weave from the logo's ticket, used as the seam between the brand
 * and the form: a horizontal strip on phones, a vertical one on desktop.
 */
const WeaveSeam = () => (
  <>
    <WeaveStrip vertical={false} className="block h-3 w-full shrink-0 lg:hidden" />
    <WeaveStrip vertical className="hidden w-3 shrink-0 self-stretch lg:block" />
  </>
)

export default AuthShell
