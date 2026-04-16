'use client'

import useSWR from 'swr'

import type { DriverSessionHistoryItemDto, DriverSessionHistoryResponseDto } from '@/lib/contracts'

import { swrFetcher } from '@/lib/swr'
import { SWR_KEYS } from '@/lib/swrKeys'
import LoadingSpinner from './LoadingSpinner'

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not started'
  }

  return new Date(value).toLocaleString()
}

function formatSnapshotValue(value: string | null | undefined, fallback: string) {
  if (!value || !value.trim()) {
    return fallback
  }

  return value
}

function getHistoryRiderTimestamp(rider: DriverSessionHistoryItemDto['riders'][number]) {
  if (rider.completedAt) {
    return { label: 'Dropped off', value: rider.completedAt }
  }

  if (rider.finalisedAt) {
    return { label: 'Finalised', value: rider.finalisedAt }
  }

  if (rider.boardedAt) {
    return { label: 'Boarded', value: rider.boardedAt }
  }

  if (rider.acceptedAt) {
    return { label: 'Accepted', value: rider.acceptedAt }
  }

  return { label: 'Joined', value: rider.joinedAt }
}

export default function DriverTripHistory({
  showHeader = true,
  title = 'Recent Trip History',
  subtitle = 'Latest closed trips for this driver, ordered by closure time.',
}: {
  showHeader?: boolean
  title?: string
  subtitle?: string
}) {
  const { data, error, isLoading, mutate } = useSWR<DriverSessionHistoryResponseDto>(
    SWR_KEYS.driverRecentHistory,
    swrFetcher,
  )
  const errorMessage = error instanceof Error ? error.message : 'Unable to load recent trip history.'
  const items = Array.isArray(data?.items) ? data.items : []
  const limit = typeof data?.limit === 'number' ? data.limit : 10
  const hasLoadedData = data !== undefined

  return (
    <section className="app-surface-card rounded-2xl p-5">
      {showHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Last {limit}
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className={`${showHeader ? 'mt-4' : ''} rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600`}>
          <LoadingSpinner label="Loading recent trips..." className="gap-2" textClassName="text-sm text-slate-600" />
        </div>
      ) : error ? (
        <div className={`${showHeader ? 'mt-4' : ''} rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>
          <div>{errorMessage}</div>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Retry History
          </button>
        </div>
      ) : hasLoadedData && items.length === 0 ? (
        <div className={`${showHeader ? 'mt-4' : ''} rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600`}>
          No recent trips yet.
        </div>
      ) : (
        <div className={`${showHeader ? 'mt-4' : ''} space-y-4`}>
          {items.map((session) => (
            <article key={session.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {session.statusLabel}
                    </span>
                    <span className="text-xs text-slate-500">Closed {formatDateTime(session.closedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Started {formatDateTime(session.openedAt)}</p>
                </div>
                <div className="grid gap-2 text-sm text-slate-600 sm:text-right">
                  <div>Total riders: {session.riderCount}</div>
                  <div>Completed: {session.completedCount}</div>
                  <div>Archived: {session.archivedCount}</div>
                </div>
              </div>

              {session.riders.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {session.riders.map((rider) => {
                    const riderTimestamp = getHistoryRiderTimestamp(rider)
                    const origin = formatSnapshotValue(rider.origin, 'Origin snapshot unavailable')
                    const destination = formatSnapshotValue(rider.destination, 'Destination snapshot unavailable')

                    return (
                      <div key={rider.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                                {rider.statusLabel}
                              </span>
                              <span className="text-xs text-slate-500">
                                {riderTimestamp.label} {formatDateTime(riderTimestamp.value)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-500">Origin</div>
                              <div className="text-base font-semibold text-slate-900">{origin}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-500">Destination</div>
                              <div className="text-base font-semibold text-slate-900">{destination}</div>
                            </div>
                          </div>
                          <div className="sm:text-right">
                            <div className="text-sm font-medium text-slate-500">Fare snapshot</div>
                            <div className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(rider.fareSnapshot)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No rider details available for this historical trip.
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}