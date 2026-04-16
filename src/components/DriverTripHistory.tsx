'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import type { DriverSessionHistoryItemDto, DriverSessionHistoryResponseDto } from '@/lib/contracts'

import { swrFetcher } from '@/lib/swr'
import LoadingSpinner from './LoadingSpinner'

const PAGE_SIZE = 10

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

function buildHistoryKey(page: number, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (search) params.set('search', search)
  return `/api/driver/session/history?${params.toString()}`
}

export default function DriverTripHistory({
  showHeader = true,
  title = 'Recent Trip History',
  subtitle = 'Closed trips for this driver, ordered by closure time.',
}: {
  showHeader?: boolean
  title?: string
  subtitle?: string
}) {
  const [inputValue, setInputValue] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(inputValue.trim())
      setPage(1)
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputValue])

  const swrKey = buildHistoryKey(page, search)
  const { data, error, isLoading, mutate } = useSWR<DriverSessionHistoryResponseDto>(swrKey, swrFetcher)

  const errorMessage = error instanceof Error ? error.message : 'Unable to load recent trip history.'
  const items = Array.isArray(data?.items) ? data.items : []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const hasLoadedData = data !== undefined

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <section className="app-surface-card rounded-2xl p-5">
      {showHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {total > 0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              {total} trip{total !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={showHeader ? 'mt-4' : ''}>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by origin or destination…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <LoadingSpinner label="Loading recent trips..." className="gap-2" textClassName="text-sm text-slate-600" />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {search ? `No trips match "${search}".` : 'No recent trips yet.'}
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {items.map((session) => {
              const isExpanded = expandedIds.has(session.id)
              return (
                <article key={session.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(session.id)}
                    aria-expanded={isExpanded}
                    className="w-full p-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                            {session.statusLabel}
                          </span>
                          <span className="text-xs text-slate-500">Closed {formatDateTime(session.closedAt)}</span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-500">Started {formatDateTime(session.openedAt)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="grid gap-1 text-xs text-slate-600 sm:text-right">
                          <div>Riders: <span className="font-semibold">{session.riderCount}</span></div>
                          <div>Completed: <span className="font-semibold text-emerald-700">{session.completedCount}</span></div>
                          <div>Archived: <span className="font-semibold">{session.archivedCount}</span></div>
                        </div>
                        <svg
                          className={`flex-shrink-0 text-slate-400 transition-transform duration-200${isExpanded ? ' rotate-180' : ''}`}
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-100 px-4 pb-4">
                      {session.riders.length > 0 ? (
                        <div className="mt-3 space-y-3">
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
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                          No rider details available for this historical trip.
                        </div>
                      )}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
