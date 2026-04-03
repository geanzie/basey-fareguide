'use client'

import useSWR from 'swr'

import type { FareRatesResponseDto } from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
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
      toneClasses: 'border-emerald-200 bg-emerald-50 text-emerald-950',
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
  title = 'Official Fare Rates',
  description = 'Current municipal fare rules and the next approved update.',
  className = '',
  variant = 'default',
}: FareRateBannerProps) {
  const { data, isLoading } = useSWR<FareRatesResponseDto>(SWR_KEYS.fareRates)

  if (isLoading && !data) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
        <p className="text-sm text-slate-500">Loading official fare rates...</p>
      </div>
    )
  }

  if (!data?.current) {
    return null
  }

  const announcement = getAnnouncementContent(data)

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {variant === 'announcement' && (
        <div className={`mb-5 rounded-2xl border px-5 py-4 ${announcement.toneClasses}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
                {announcement.badge}
              </p>
              <h3 className="mt-2 text-2xl font-bold">{announcement.headline}</h3>
              <p className="mt-2 max-w-3xl text-sm opacity-90">{announcement.detail}</p>
            </div>
            <div className="rounded-xl border border-current/15 bg-white/70 px-4 py-3 text-sm font-medium">
              {announcement.effectiveLabel}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Active as of {formatManilaDateTimeLabel(data.current.effectiveAt)}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Current fare</div>
          <div className="mt-3 space-y-2 text-sm text-emerald-900">
            <div className="flex items-center justify-between">
              <span>Base fare ({data.current.baseDistanceKm} km)</span>
              <span className="font-semibold">{formatCurrency(data.current.baseFare)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Per additional km</span>
              <span className="font-semibold">{formatCurrency(data.current.perKmRate)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-blue-700">Upcoming fare</div>
          {data.upcoming ? (
            <div className="mt-3 space-y-2 text-sm text-blue-900">
              <div className="flex items-center justify-between">
                <span>Base fare ({data.upcoming.baseDistanceKm} km)</span>
                <span className="font-semibold">{formatCurrency(data.upcoming.baseFare)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Per additional km</span>
                <span className="font-semibold">{formatCurrency(data.upcoming.perKmRate)}</span>
              </div>
              <p className="pt-2 text-xs text-blue-700">
                Effective {formatManilaDateTimeLabel(data.upcoming.effectiveAt)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-blue-900">No future fare change is scheduled right now.</p>
          )}
        </div>
      </div>
    </section>
  )
}
