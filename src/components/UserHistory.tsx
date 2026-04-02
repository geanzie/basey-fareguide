'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { flexibleFetch } from '@/lib/api'
import type { FareCalculationsResponseDto, IncidentsResponseDto } from '@/lib/contracts'

interface HistoryItem {
  id: string
  type: 'route' | 'incident'
  title: string
  subtitle: string
  description: string
  status?: string
  fare?: string
  originalFare?: string
  discountApplied?: number
  date: string
  createdAt: string
}

type HistoryFilter = 'all' | 'routes' | 'incidents'

export default function UserHistory() {
  const searchParams = useSearchParams()
  const urlFilter = searchParams.get('filter')
  const initialFilter = (urlFilter === 'reports' ? 'incidents' : urlFilter) as HistoryFilter | null

  const [allHistoryItems, setAllHistoryItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  useEffect(() => {
    void fetchHistory()
  }, [currentPage])

  const filteredHistory = useMemo(() => {
    let items = allHistoryItems

    if (filter !== 'all') {
      const expectedType = filter === 'routes' ? 'route' : 'incident'
      items = items.filter((item) => item.type === expectedType)
    }

    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return items
    }

    return items.filter((item) => {
      return [
        item.title,
        item.subtitle,
        item.description,
        item.status || '',
        item.date,
        item.fare || '',
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [allHistoryItems, filter, searchQuery])

  const counts = useMemo(
    () => ({
      all: allHistoryItems.length,
      routes: allHistoryItems.filter((item) => item.type === 'route').length,
      incidents: allHistoryItems.filter((item) => item.type === 'incident').length,
    }),
    [allHistoryItems],
  )

  async function fetchHistory() {
    try {
      setLoading(true)
      setError(null)

      const [fareCalculationsResult, incidentsResult] = await Promise.all([
        flexibleFetch<FareCalculationsResponseDto>(`/api/fare-calculations?page=${currentPage}&limit=10`),
        flexibleFetch<IncidentsResponseDto>(`/api/incidents?page=${currentPage}&limit=10`),
      ])

      if (!fareCalculationsResult.success) {
        if (fareCalculationsResult.requiresAuth) {
          throw new Error('Please log in to view your fare calculation history.')
        }

        throw new Error(`Failed to fetch calculations: ${fareCalculationsResult.message}`)
      }

      if (!incidentsResult.success) {
        if (incidentsResult.requiresAuth) {
          throw new Error('Please log in to view your incident history.')
        }

        throw new Error(`Failed to fetch incidents: ${incidentsResult.message}`)
      }

      const fareData = fareCalculationsResult.data || {
        calculations: [],
        pagination: {
          page: currentPage,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      }

      const incidentsData = incidentsResult.data || { incidents: [] }

      const routeItems: HistoryItem[] = (fareData.calculations || []).map((calculation) => ({
        id: `route-${calculation.id}`,
        type: 'route',
        title: `${calculation.from} to ${calculation.to}`,
        subtitle: `${calculation.distanceKm.toFixed(1)} km`,
        description: `${calculation.calculationType} calculation`,
        fare: `PHP ${calculation.fare.toFixed(2)}`,
        originalFare:
          calculation.originalFare !== null ? `PHP ${calculation.originalFare.toFixed(2)}` : undefined,
        discountApplied: calculation.discountApplied ?? undefined,
        date: new Date(calculation.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        createdAt: calculation.createdAt,
      }))

      const incidentItems: HistoryItem[] = (incidentsData.incidents || []).map((incident) => ({
        id: `incident-${incident.id}`,
        type: 'incident',
        title: incident.typeLabel,
        subtitle: incident.location,
        description: incident.description,
        status: incident.statusLabel,
        date: new Date(incident.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        createdAt: incident.createdAt,
      }))

      const combinedItems = [...routeItems, ...incidentItems].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )

      setAllHistoryItems(combinedItems)
      setPagination(
        fareData.pagination || {
          page: currentPage,
          limit: 20,
          total: combinedItems.length,
          totalPages: 1,
        },
      )
    } catch (caughtError) {
      if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError('Failed to load history. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading && allHistoryItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="mt-3 text-gray-600">Loading your history...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-800">Unable to load history</h3>
        <p className="mt-2 text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">History</h2>
            <p className="mt-2 text-sm text-slate-600">
              Review saved fare calculations and incident reports in one timeline.
            </p>
          </div>

          <div className="w-full lg:max-w-md">
            <label className="mb-2 block text-sm font-medium text-gray-700">Search history</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search routes, locations, statuses, or fares"
              className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <FilterChip
            active={filter === 'all'}
            label={`All activity (${counts.all})`}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            active={filter === 'routes'}
            label={`Fare calculations (${counts.routes})`}
            onClick={() => setFilter('routes')}
          />
          <FilterChip
            active={filter === 'incidents'}
            label={`Incident reports (${counts.incidents})`}
            onClick={() => setFilter('incidents')}
          />
        </div>

        {searchQuery ? (
          <p className="mt-3 text-sm text-gray-600">
            Showing <span className="font-semibold text-emerald-700">{filteredHistory.length}</span> result
            {filteredHistory.length === 1 ? '' : 's'} for "{searchQuery}".
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900">Activity timeline</h3>
          <p className="mt-1 text-sm text-slate-600">Newest items appear first.</p>
        </div>

        <div className="p-6">
          {filteredHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <h4 className="text-base font-semibold text-slate-900">
                {searchQuery ? 'No matching activity found' : 'No saved activity yet'}
              </h4>
              <p className="mt-2 text-sm text-slate-600">
                {searchQuery
                  ? 'Try a broader search or clear the filter.'
                  : filter === 'routes'
                    ? 'You have not saved any fare calculations yet.'
                    : filter === 'incidents'
                      ? 'You have not reported any incidents yet.'
                      : 'You have not saved any fare calculations or incident reports yet.'}
              </p>
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Clear search
                  </button>
                ) : (
                  <>
                    <Link
                      href="/calculator"
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Calculate fare
                    </Link>
                    <Link
                      href="/report"
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Report incident
                    </Link>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={item.type} />
                        {item.status ? <StatusBadge status={item.status} /> : null}
                      </div>
                      <h4 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                      <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm text-slate-500">{item.date}</p>
                      {item.fare ? (
                        <div className="mt-2">
                          {item.originalFare && item.discountApplied ? (
                            <>
                              <p className="text-xs text-slate-500 line-through">{item.originalFare}</p>
                              <p className="text-base font-semibold text-emerald-600">{item.fare}</p>
                              <p className="text-xs text-emerald-600">
                                Saved PHP {item.discountApplied.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-base font-semibold text-emerald-600">{item.fare}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {filteredHistory.length > 0 && pagination.totalPages > 1 ? (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-700">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((previous) => Math.min(pagination.totalPages, previous + 1))}
                disabled={currentPage >= pagination.totalPages}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium ${
        active ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}

function TypeBadge({ type }: { type: 'route' | 'incident' }) {
  const classes =
    type === 'route' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      {type === 'route' ? 'Fare calculation' : 'Incident report'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    INVESTIGATING: 'bg-blue-100 text-blue-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
