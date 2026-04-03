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
}

export default function FareRateBanner({
  title = 'Official Fare Rates',
  description = 'Current municipal fare rules and the next approved update.',
  className = '',
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

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
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
