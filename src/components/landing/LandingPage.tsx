import Link from 'next/link'
import type { ReactNode } from 'react'

import BrandMark from '@/components/BrandMark'
import type { FareRatesResponseDto } from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { ORDINANCE_105_FACTS, ORDINANCE_105_FARE_POINTS } from '@/lib/ordinance105Digest'
import { ordinanceResource } from '@/lib/ordinanceResource'

/**
 * Public landing page for signed-out visitors. It borrows the sign-in screen's
 * materials — forest panel, straw display type, the banig photos with their
 * tikog binding — but stacks them in one column instead of splitting the screen.
 * No announcements here: the page explains the app and the ordinance, and the
 * one live figure is the fare rate in force.
 */

interface LandingPageProps {
  /** Null when the rate could not be read; the page then shows no figure at all. */
  fareRates: FareRatesResponseDto | null
}

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3E6C4]'
const PHONE_MASK = 'linear-gradient(to left, #000 55%, transparent)'

/** ₱15 for whole pesos, ₱3.50 with centavos — the same rule the dashboards use. */
function formatCurrency(value: number) {
  return Number.isInteger(value) ? `₱${value}` : `₱${value.toFixed(2)}`
}

const ROLES: Array<{ role: string; summary: string; features: string[] }> = [
  {
    role: 'Riders',
    summary: 'Check the fare before you board, and keep a record after.',
    features: [
      'Fare calculator that measures your route by road, not a straight line',
      '20% off for students, senior citizens and persons with disability',
      'Scan the permit QR sticker on the vehicle to log your trip and fare',
      'Report overcharging, with photos as evidence',
    ],
  },
  {
    role: 'Drivers',
    summary: 'Record each trip and the fare charged, right from your phone.',
    features: [],
  },
  {
    role: 'Enforcers',
    summary: 'Follow up overcharging reports against the approved fare.',
    features: [],
  },
  {
    role: 'Municipal staff',
    summary: 'Publish fare changes with the Sangguniang Bayan issuance behind them.',
    features: [],
  },
]

const LandingPage = ({ fareRates }: LandingPageProps) => (
  <div className="flex flex-1 flex-col bg-surface text-ink-body">
    <Hero />
    <AppSection fareRates={fareRates} />
    <OrdinanceSection />
    <LandingFooter />
  </div>
)

const Container = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>
)

const Hero = () => (
  <header className="relative overflow-hidden bg-[#14532D] text-white">
    {/* Tablets: the same tikog strip that edges the sign-in header, kept to
        the space right of the text. Phones have no such space, so none. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[calc(100%-38rem)] bg-[url('/brand/banig-mat.webp')] bg-cover bg-center sm:block lg:hidden"
      style={{ maskImage: PHONE_MASK, WebkitMaskImage: PHONE_MASK }}
    />
    {/* Desktop: a round mat half off the right edge, bound in tikog like the
        one in the sign-in panel's corner. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-[-16rem] top-1/2 hidden size-[44rem] -translate-y-1/2 rounded-full bg-[url('/brand/banig-mat.webp')] bg-cover bg-left shadow-[0_0_0_6px_#E6D3A8,0_0_0_7px_rgba(0,0,0,0.25),0_24px_60px_rgba(0,0,0,0.45)] lg:block xl:right-[-12rem]"
    />

    <Container className="relative">
      <nav className="flex items-center justify-between gap-4 py-5" aria-label="Main">
        <Link href="/" className={`flex items-center gap-3 rounded-lg ${FOCUS_RING}`}>
          <BrandMark size="md" tone="dark" />
          <span className="whitespace-nowrap font-brand text-lg font-extrabold sm:text-xl">Basey FareCheck</span>
        </Link>
        <Link
          href="/login"
          className={`shrink-0 whitespace-nowrap rounded-full bg-[#F3E6C4] px-4 py-2 text-sm sm:px-5 font-semibold text-[#14532D] transition hover:bg-white ${FOCUS_RING}`}
        >
          Sign in
        </Link>
      </nav>

      <div className="max-w-xl pb-16 pt-10 sm:pb-20 lg:max-w-2xl lg:pb-28 lg:pt-20">
        <h1 className="font-brand text-4xl font-extrabold leading-[1.05] text-balance text-[#F3E6C4] sm:text-5xl lg:text-6xl">
          Know the fare before you ride.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-white/80 lg:text-lg">
          Basey FareCheck is the municipality&apos;s fare guide for tricycles and habal-habal. It
          shows the fare the Sangguniang Bayan approved, records each trip, and gives riders a
          way to report overcharging.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className={`rounded-xl bg-[#F3E6C4] px-5 py-3 text-sm font-semibold text-[#14532D] transition hover:bg-white ${FOCUS_RING}`}
          >
            Sign in or create an account
          </Link>
          <a
            href="#ordinance"
            className={`rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 ${FOCUS_RING}`}
          >
            Read what the ordinance says
          </a>
        </div>
      </div>
    </Container>
  </header>
)

const AppSection = ({ fareRates }: LandingPageProps) => (
  <section aria-labelledby="app-heading" className="py-16 lg:py-24">
    <Container className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div>
        <h2 id="app-heading" className="font-brand text-3xl font-extrabold text-ink-strong lg:text-4xl">
          One fare guide for everyone on the road
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-muted">
          Riders, drivers, enforcers and municipal staff each sign in to their own view of the
          same records, so the fare a rider sees is the fare a driver charges and the fare an
          enforcer checks.
        </p>

        <dl className="mt-10 divide-y divide-surface-border border-y border-surface-border">
          {ROLES.map(({ role, summary, features }) => (
            <div key={role} className="grid gap-2 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-8">
              <dt className="font-brand text-lg font-extrabold text-[#14532D]">{role}</dt>
              <dd>
                <p className="font-medium text-ink-strong">{summary}</p>
                {features.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                    {features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <aside className="lg:pt-2">
        <FareRateCard fareRates={fareRates} />
      </aside>
    </Container>
  </section>
)

const FareRateCard = ({ fareRates }: LandingPageProps) => {
  if (!fareRates) {
    return (
      <div className="rounded-plate bg-[#14532D] p-6 text-white lg:sticky lg:top-8">
        <h3 className="font-brand text-lg font-extrabold text-[#F3E6C4]">Fare in force today</h3>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          The current rate could not be loaded right now. Sign in to check it in the fare
          calculator, or reload this page in a moment.
        </p>
      </div>
    )
  }

  const { current, upcoming } = fareRates

  return (
    <div className="rounded-plate bg-[#14532D] p-6 text-white lg:sticky lg:top-8">
      <h3 className="font-brand text-lg font-extrabold text-[#F3E6C4]">Fare in force today</h3>
      <p className="mt-1 text-xs text-white/70">
        Approved by the Sangguniang Bayan
        {current.effectiveAt ? `, in force since ${formatManilaDateTimeLabel(current.effectiveAt)}` : ''}
      </p>

      <p className="mt-6 font-brand text-6xl font-extrabold tabular-nums text-[#F3E6C4]">
        {formatCurrency(current.baseFare)}
      </p>
      <p className="mt-1 text-sm text-white/80">for the first {current.baseDistanceKm} km</p>

      <div className="mt-5 border-t border-white/15 pt-5">
        <p className="font-brand text-3xl font-extrabold tabular-nums text-white">
          +{formatCurrency(current.perKmRate)}
        </p>
        <p className="mt-1 text-sm text-white/80">for each kilometer after that</p>
      </div>

      <p className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/90">
        Students, senior citizens and persons with disability pay 20% less.
      </p>

      {upcoming ? (
        <p className="mt-4 text-xs leading-relaxed text-[#E6D3A8]">
          Changing to {formatCurrency(upcoming.baseFare)} base and {formatCurrency(upcoming.perKmRate)} per
          km on {formatManilaDateTimeLabel(upcoming.effectiveAt)}.
        </p>
      ) : null}
    </div>
  )
}

const OrdinanceSection = () => (
  <section
    id="ordinance"
    aria-labelledby="ordinance-heading"
    className="scroll-mt-4 border-t border-[#E6D3A8] bg-[#FBF6EA] py-14 lg:py-20"
  >
    <Container>
      <div className="max-w-3xl">
        <h2 id="ordinance-heading" className="font-brand text-3xl font-extrabold text-ink-strong lg:text-4xl">
          {ordinanceResource.shortTitle}
          <span className="mt-1 block text-xl text-[#14532D] lg:text-2xl">Series of 2023</span>
        </h2>
        <p className="mt-4 leading-relaxed text-ink-body">
          The ordinance that regulates every tricycle-for-hire and motorcycle-for-hire in Basey.
          It amends {ORDINANCE_105_FACTS.amends}, and every fare in this app traces back to it.
        </p>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Sponsored by" value={ORDINANCE_105_FACTS.sponsor} />
        <Fact label="Enacted" value={ORDINANCE_105_FACTS.enacted} />
        <Fact label="Vote" value={ORDINANCE_105_FACTS.vote} />
        <Fact label="In force" value={ORDINANCE_105_FACTS.effectivity} />
      </dl>

      <h3 className="mt-12 font-brand text-xl font-extrabold text-ink-strong">
        What it says about fares
      </h3>
      <ul className="mt-5 grid gap-x-10 gap-y-4 border-y border-[#E6D3A8] py-6 lg:grid-cols-2">
        {ORDINANCE_105_FARE_POINTS.map((point) => (
          <li key={point.section} className="flex gap-3 text-sm leading-relaxed">
            <SectionTag section={point.section} />
            <span>{point.text}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/ordinance"
          className="rounded-xl bg-[#14532D] px-5 py-3 text-sm font-semibold text-[#F3E6C4] transition hover:bg-[#0f3f22] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
        >
          Read the full ordinance
        </Link>
        <a
          href={ordinanceResource.pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-[#14532D]/30 px-5 py-3 text-sm font-semibold text-[#14532D] transition hover:bg-[#14532D]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
        >
          Download the PDF
        </a>
      </div>
    </Container>
  </section>
)

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="border-l-2 border-[#14532D] pl-4">
    <dt className="text-xs text-ink-muted">{label}</dt>
    <dd className="mt-1 font-medium text-ink-strong">{value}</dd>
  </div>
)

const SectionTag = ({ section }: { section: string }) => (
  <span className="mt-0.5 h-fit shrink-0 whitespace-nowrap rounded-md bg-[#14532D]/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-[#14532D]">
    Sec. {section}
  </span>
)

const LandingFooter = () => (
  <footer className="bg-[#14532D] py-8 text-sm text-white/70">
    <Container className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p>&copy; 2025 Municipality of Basey, Samar, Philippines</p>
      <p>{ordinanceResource.effectiveLabel}</p>
    </Container>
  </footer>
)

export default LandingPage
