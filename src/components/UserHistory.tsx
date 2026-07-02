'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { History } from 'lucide-react'

import Badge from '@/ui/Badge'
import Button from '@/ui/Button'
import Card from '@/ui/Card'
import EmptyState from '@/ui/EmptyState'
import FilterChips from '@/ui/FilterChips'
import SearchBar from '@/ui/SearchBar'
import { ListSkeleton } from '@/ui/Skeleton'
import { swrFetcher } from '@/lib/swr'
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function UserHistory() {
  const searchParams = useSearchParams()
  const urlFilter = searchParams.get('filter')
  const initialFilter = (urlFilter === 'reports' ? 'incidents' : urlFilter) as HistoryFilter | null

  const [filter, setFilter] = useState<HistoryFilter>(initialFilter || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: fareData, error: fareError, isLoading: fareLoading } =
    useSWR<FareCalculationsResponseDto>(
      `/api/fare-calculations?page=${currentPage}&limit=10`,
      swrFetcher,
    )
  const { data: incidentsData, error: incidentsError, isLoading: incidentsLoading } =
    useSWR<IncidentsResponseDto>(`/api/incidents?page=${currentPage}&limit=10`, swrFetcher)

  const loading = fareLoading || incidentsLoading
  const error = fareError || incidentsError

  const allHistoryItems = useMemo<HistoryItem[]>(() => {
    const routeItems: HistoryItem[] = (fareData?.calculations || []).map((calculation) => ({
      id: `route-${calculation.id}`,
      type: 'route',
      title: `${calculation.from} to ${calculation.to}`,
      subtitle: `${calculation.distanceKm.toFixed(1)} km`,
      description: `${calculation.calculationType} calculation`,
      fare: `PHP ${calculation.fare.toFixed(2)}`,
      originalFare:
        calculation.originalFare !== null ? `PHP ${calculation.originalFare.toFixed(2)}` : undefined,
      discountApplied: calculation.discountApplied ?? undefined,
      date: formatDate(calculation.createdAt),
      createdAt: calculation.createdAt,
    }))

    const incidentItems: HistoryItem[] = (incidentsData?.incidents || []).map((incident) => ({
      id: `incident-${incident.id}`,
      type: 'incident',
      title: incident.typeLabel,
      subtitle: incident.location,
      description: incident.description,
      status: incident.status,
      date: formatDate(incident.createdAt),
      createdAt: incident.createdAt,
    }))

    return [...routeItems, ...incidentItems].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
  }, [fareData, incidentsData])

  const pagination = fareData?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 }

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

  if (loading && allHistoryItems.length === 0) {
    return <ListSkeleton count={4} variant="complex" />
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={History}
          title="Unable to load history"
          message={error instanceof Error ? error.message : 'Failed to load history. Please try again.'}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search routes, locations, statuses, or fares"
        />

        <div className="mt-4">
          <FilterChips
            options={[
              { value: 'all', label: 'All activity', count: counts.all },
              { value: 'routes', label: 'Fare calculations', count: counts.routes },
              { value: 'incidents', label: 'Incident reports', count: counts.incidents },
            ]}
            value={filter}
            onChange={(value) => setFilter(value as HistoryFilter)}
          />
        </div>

        {searchQuery ? (
          <p className="mt-3 text-sm text-ink-muted">
            Showing <span className="font-semibold text-primary-dark">{filteredHistory.length}</span> result
            {filteredHistory.length === 1 ? '' : 's'} for &quot;{searchQuery}&quot;.
          </p>
        ) : null}
      </Card>

      {filteredHistory.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title={searchQuery ? 'No matching activity found' : 'No saved activity yet'}
            message={
              searchQuery
                ? 'Try a broader search or clear the filter.'
                : filter === 'routes'
                  ? 'You have not saved any fare calculations yet.'
                  : filter === 'incidents'
                    ? 'You have not reported any incidents yet.'
                    : 'You have not saved any fare calculations or incident reports yet.'
            }
            action={
              searchQuery ? (
                <Button size="sm" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Link href="/calculator">
                    <Button size="sm">Calculate fare</Button>
                  </Link>
                  <Link href="/report">
                    <Button size="sm" variant="danger">
                      Report incident
                    </Button>
                  </Link>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          <div>
            <h3 className="text-lg font-bold text-ink-strong">Activity timeline</h3>
            <p className="mt-0.5 text-sm text-ink-muted">Newest items appear first.</p>
          </div>
          {filteredHistory.map((item) => (
            <Card key={item.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      label={item.type === 'route' ? 'Fare calculation' : 'Incident report'}
                      tone={item.type === 'route' ? 'info' : 'danger'}
                    />
                    {item.status ? <Badge label={item.status} /> : null}
                  </div>
                  <h4 className="mt-3 text-base font-bold text-ink-strong">{item.title}</h4>
                  <p className="mt-1 text-sm text-ink-muted">{item.subtitle}</p>
                  <p className="mt-2 text-sm text-ink-body">{item.description}</p>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-sm text-ink-faint">{item.date}</p>
                  {item.fare ? (
                    <div className="mt-2">
                      {item.originalFare && item.discountApplied ? (
                        <>
                          <p className="text-xs text-ink-faint line-through">{item.originalFare}</p>
                          <p className="text-base font-bold text-primary">{item.fare}</p>
                          <p className="text-xs text-primary">
                            Saved PHP {item.discountApplied.toFixed(2)}
                          </p>
                        </>
                      ) : (
                        <p className="text-base font-bold text-primary">{item.fare}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredHistory.length > 0 && pagination.totalPages > 1 ? (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
            >
              Previous
            </Button>
            <span className="rounded-lg bg-surface-tint px-3 py-2 text-sm font-semibold text-primary-dark">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => setCurrentPage((previous) => Math.min(pagination.totalPages, previous + 1))}
            >
              Next
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}
