'use client'

import Link from 'next/link'
import useSWR from 'swr'

import type {
  FareRateDocumentEntryDto,
  FareRateDocumentsResponseDto,
  FareRatesResponseDto,
} from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

/**
 * The About page's list of every issuance, newest first. Used as the fallback
 * whenever the version on show has no document of its own — a rate can be
 * published before its paper is uploaded, and getDocumentedFareRateVersions
 * filters those out, so /fare-documents/[versionId] would dead-end there.
 */
const ABOUT_DOCUMENTS_HREF = '/profile/about#fare-rate-documents'

/** ₱15 for whole pesos, ₱3.50 with centavos — the same rule the dashboards use. */
function formatCurrency(value: number) {
  return Number.isInteger(value) ? `₱${value}` : `₱${value.toFixed(2)}`
}

function documentHref(
  versionId: string | null | undefined,
  documents: FareRateDocumentEntryDto[],
) {
  if (versionId && documents.some((entry) => entry.versionId === versionId)) {
    return `/fare-documents/${versionId}`
  }
  return ABOUT_DOCUMENTS_HREF
}

interface FareRateBannerProps {
  title?: string
  description?: string
  className?: string
  variant?: 'default' | 'announcement'
}

function getAnnouncementContent(data: FareRatesResponseDto) {
  if (!data.upcoming) {
    return {
      isIncrease: false,
      toneClasses: 'border-primary/20 bg-surface-tint text-primary-dark',
      badge: 'No new fare change',
      headline: 'Current fare rates remain in effect',
      detail: `Base fare stays at ${formatCurrency(data.current.baseFare)} and the additional kilometer rate stays at ${formatCurrency(data.current.perKmRate)} until a new ordinance-backed update is approved.`,
      effectiveLabel: `Active since ${formatManilaDateTimeLabel(data.current.effectiveAt)}`,
    }
  }

  const baseChanged = data.upcoming.baseFare !== data.current.baseFare
  const perKmChanged = data.upcoming.perKmRate !== data.current.perKmRate
  const isIncrease =
    data.upcoming.baseFare > data.current.baseFare ||
    data.upcoming.perKmRate > data.current.perKmRate
  const isDecrease =
    data.upcoming.baseFare < data.current.baseFare ||
    data.upcoming.perKmRate < data.current.perKmRate

  const changeParts: string[] = []
  if (baseChanged) {
    changeParts.push(
      `base fare from ${formatCurrency(data.current.baseFare)} to ${formatCurrency(data.upcoming.baseFare)}`,
    )
  }
  if (perKmChanged) {
    changeParts.push(
      `additional kilometer rate from ${formatCurrency(data.current.perKmRate)} to ${formatCurrency(data.upcoming.perKmRate)}`,
    )
  }

  const headline = isIncrease
    ? 'Upcoming fare hike approved'
    : isDecrease
      ? 'Upcoming fare reduction approved'
      : 'Upcoming fare schedule approved'

  return {
    isIncrease,
    toneClasses: isIncrease
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-blue-200 bg-blue-50 text-blue-950',
    badge: 'Announcement',
    headline,
    detail:
      changeParts.length > 0
        ? `The municipality approved a change to ${changeParts.join(' and ')}.`
        : 'A new fare schedule is approved and will take effect at the posted time.',
    effectiveLabel: `Effective ${formatManilaDateTimeLabel(data.upcoming.effectiveAt)}`,
  }
}

export default function FareRateBanner({
  title = 'Fare Rates',
  description = 'Current municipal fare rules and the next approved update.',
  className = '',
  variant = 'default',
}: FareRateBannerProps) {
  const { data, isLoading } = useSWR<FareRatesResponseDto>(SWR_KEYS.fareRates)
  // Same key FareRateDocumentsSection reads, so on /profile/about the two share
  // one request. Only tells us which versions actually have an issuance on file.
  const { data: documentsData } = useSWR<FareRateDocumentsResponseDto>(SWR_KEYS.fareRateDocuments)

  if (isLoading && !data) {
    return (
      <div className={`rounded-card border border-surface-border bg-surface p-4 shadow-card ${className}`.trim()}>
        <p className="text-sm text-ink-muted">Loading official fare rates...</p>
      </div>
    )
  }

  if (!data?.current) {
    return null
  }

  const announcement = getAnnouncementContent(data)
  const documents = documentsData?.documents ?? []
  // The announcement is about the change, so it points at the version that
  // change introduces; the rate panel below is about what riders pay today.
  const announcedHref = documentHref(
    data.upcoming?.versionId ?? data.current.versionId,
    documents,
  )
  const currentHref = documentHref(data.current.versionId, documents)

  return (
    <section className={`rounded-card border border-surface-border bg-surface p-4 shadow-card ${className}`.trim()}>
      {variant === 'announcement' && (
        <div className={`mb-4 rounded-xl border px-4 py-4 ${announcement.toneClasses}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold opacity-80">
                {announcement.badge}
              </p>
              <h3 className="mt-1 font-brand text-lg font-bold">{announcement.headline}</h3>
              <p className="mt-2 max-w-3xl text-sm opacity-90">{announcement.detail}</p>
              <Link
                href={announcedHref}
                className="mt-3 inline-flex items-center rounded-card border border-current/25 bg-white/70 px-3 py-2 text-sm font-semibold underline-offset-2 hover:underline"
              >
                {data.upcoming
                  ? 'See the issuance that authorized this change'
                  : 'See the ordinance behind this rate'}
              </Link>
            </div>
            <div className="rounded-xl border border-current/15 bg-white/70 px-4 py-3 text-sm font-medium">
              {announcement.effectiveLabel}
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-brand text-lg font-bold text-ink-strong">{title}</h2>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
        <Link
          href={currentHref}
          className="rounded text-sm font-semibold text-primary-dark underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          See the ordinance behind this rate
        </Link>
      </header>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-primary/35 bg-surface-tint p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="text-sm font-semibold text-primary-dark">Current fare</p>
            <p className="text-xs text-ink-muted">Since {formatManilaDateTimeLabel(data.current.effectiveAt)}</p>
          </div>
          <RateRows
            baseDistanceKm={data.current.baseDistanceKm}
            baseFare={data.current.baseFare}
            perKmRate={data.current.perKmRate}
          />
        </div>

        {data.upcoming ? (
          <div
            className={`rounded-xl border p-4 ${
              announcement.isIncrease
                ? 'border-warning/60 bg-warning/5'
                : 'border-surface-border bg-surface-alt'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-ink-strong">Upcoming fare</p>
              <p className="text-xs text-ink-muted">From {formatManilaDateTimeLabel(data.upcoming.effectiveAt)}</p>
            </div>
            <RateRows
              baseDistanceKm={data.upcoming.baseDistanceKm}
              baseFare={data.upcoming.baseFare}
              perKmRate={data.upcoming.perKmRate}
            />
          </div>
        ) : (
          <div className="flex flex-col justify-center rounded-xl border border-dashed border-surface-border bg-surface-alt p-4">
            <p className="text-sm font-semibold text-ink-strong">Upcoming fare</p>
            <p className="mt-1 text-sm text-ink-muted">No future fare change is scheduled right now.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function RateRows({
  baseDistanceKm,
  baseFare,
  perKmRate,
}: {
  baseDistanceKm: number
  baseFare: number
  perKmRate: number
}) {
  return (
    <dl className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-ink-body">Base fare, first {baseDistanceKm} km</dt>
        <dd className="font-brand font-bold tabular-nums text-ink-strong">{formatCurrency(baseFare)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-ink-body">Per additional km</dt>
        <dd className="font-brand font-bold tabular-nums text-ink-strong">{formatCurrency(perKmRate)}</dd>
      </div>
    </dl>
  )
}
