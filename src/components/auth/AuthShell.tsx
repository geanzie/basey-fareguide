import type { ReactNode } from 'react'
import Link from 'next/link'

import BanigCornerMat from '@/components/BanigCornerMat'
import BrandMark from '@/components/BrandMark'

interface AuthShellProps {
  title: string
  /** One line under the title, e.g. what this step needs from the user. */
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * Shared frame for every sign-in, sign-up and password-reset screen: forest
 * brand panel, then the form on white. Panel on top on phones; an even 50/50
 * split on `lg`, where the brand side stays put while a long form scrolls. The form column is one fixed
 * width on every screen, so switching between sign-in, sign-up and reset
 * never shifts the fields.
 */
const AuthShell = ({ title, subtitle, children }: AuthShellProps) => (
  <div className="flex flex-1 flex-col bg-surface lg:flex-row">
    <div className="flex flex-col lg:h-dvh lg:w-1/2 lg:shrink-0 lg:flex-row">
      <BrandPanel />
    </div>

    {/* On lg this column scrolls by itself with its scrollbar gutter always
        reserved, so a long form's scrollbar never nudges the fields sideways. */}
    <div className="flex flex-1 justify-center px-6 pb-10 pt-7 lg:h-dvh lg:flex-col lg:items-center lg:overflow-y-auto lg:px-12 lg:py-8 lg:[scrollbar-gutter:stable]">
      <div className="w-full max-w-md lg:my-auto">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-ink-strong lg:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
      {/* Stands in for the site footer, which auth screens hide. On phones the
          form is the whole screen, so the line is left out there. */}
      <p className="hidden pt-6 text-xs text-ink-muted lg:block">
        &copy; 2025 Municipality of Basey, Samar, Philippines
      </p>
    </div>
  </div>
)

const PHONE_MASK = 'linear-gradient(to left, #000 55%, transparent)'

/**
 * Photos of real Basey banig in the brand panel, placed where the panel has
 * no text. Below lg the panel is a short header, so the natural tikog mat
 * fills its right edge (the space right of the centered column from sm up),
 * as on every app header.
 *
 * On lg a round mat is laid into the panel's bottom-left corner, so its rim
 * sweeps diagonally from the left edge down past the right edge, the way the
 * round mats sit in the source photo. At 115% of the panel's width by 56% of
 * its height it covers just under half the forest; the text sits in the top
 * 44% above it. A tikog-coloured binding and a soft shadow lift the mat off
 * the forest.
 */
const BanigPhoto = () => (
  <>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-[36%] bg-[url('/brand/banig-mat.webp')] bg-cover bg-center sm:w-[calc(50%-10rem)] lg:hidden"
      style={{ maskImage: PHONE_MASK, WebkitMaskImage: PHONE_MASK }}
    />
    <BanigCornerMat className="hidden lg:block" />
  </>
)

/**
 * Brand half: a compact header on phones, the whole left side on desktop.
 */
const BrandPanel = () => (
  <aside className="relative flex overflow-hidden bg-[#14532D] px-6 pb-7 pt-6 text-white lg:flex-1 lg:px-14 lg:py-10">
    <BanigPhoto />
    {/* Below lg this column lines up with the centered form underneath it. */}
    <div className="relative mx-auto flex w-full max-w-md flex-col lg:mx-0 lg:max-w-none">
      <Link
        href="/"
        aria-label="Basey FareCheck home"
        className="flex w-fit items-center gap-3 rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3E6C4] focus-visible:ring-offset-4 focus-visible:ring-offset-[#14532D]"
      >
        <BrandMark size="md" tone="dark" />
        <h1 className="font-brand text-xl font-extrabold">Basey FareCheck</h1>
      </Link>

      {/* On lg this block sits in the top 44% of the panel, above the mat. The
          largest size waits for a tall screen as well as a wide one. */}
      <div className="mt-7 max-w-xl lg:mt-10 xl:[@media(min-height:880px)]:mt-16">
        <p className="font-brand text-3xl font-extrabold leading-[1.05] text-balance text-[#F3E6C4] sm:text-4xl lg:text-5xl xl:[@media(min-height:880px)]:text-6xl">
          Know the fare before you ride.
        </p>
        <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-white/75 sm:block lg:mt-4 lg:text-base">
          Official fares for every tricycle and habal-habal in
          Basey, set by Municipal Ordinance 105, Series of 2023.
        </p>
      </div>
    </div>
  </aside>
)

export default AuthShell
