'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { SearchX } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import RoleGuard from '@/components/RoleGuard'
import Badge from '@/ui/Badge'
import Card from '@/ui/Card'
import EmptyState from '@/ui/EmptyState'
import FilterChips from '@/ui/FilterChips'
import GradientHeader from '@/ui/GradientHeader'
import SearchBar from '@/ui/SearchBar'
import { ListSkeleton, StatGridSkeleton } from '@/ui/Skeleton'
import StatTile from '@/ui/StatTile'
import { swrFetcher } from '@/lib/swr'
import { SWR_KEYS } from '@/lib/swrKeys'
import type { IncidentsResponseDto } from '@/lib/contracts'

const STATUSES = ['PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'] as const

export default function AdminIncidentsPage() {
  const { status, user } = useAuth()
  const canLoadIncidents = status === 'authenticated' && user?.userType === 'ADMIN'

  const { data, error, isLoading } = useSWR<IncidentsResponseDto>(
    canLoadIncidents ? SWR_KEYS.incidents : null,
    swrFetcher,
  )
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const incidents = data?.incidents ?? []

  const filteredIncidents = incidents.filter(incident => {
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter

    if (!searchQuery.trim()) {
      return matchesStatus
    }

    const query = searchQuery.toLowerCase()
    const matchesSearch =
      incident.ticketNumber?.toLowerCase().includes(query) ||
      incident.type.toLowerCase().includes(query) ||
      incident.description.toLowerCase().includes(query) ||
      incident.location.toLowerCase().includes(query) ||
      `${incident.reportedBy?.firstName || ''} ${incident.reportedBy?.lastName || ''}`.toLowerCase().includes(query) ||
      (incident.handledBy && `${incident.handledBy.firstName} ${incident.handledBy.lastName}`.toLowerCase().includes(query))

    return matchesStatus && matchesSearch
  })

  const incidentCounts: Record<string, number> = {
    all: incidents.length,
    PENDING: incidents.filter(i => i.status === 'PENDING').length,
    INVESTIGATING: incidents.filter(i => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter(i => i.status === 'RESOLVED').length,
    DISMISSED: incidents.filter(i => i.status === 'DISMISSED').length,
  }

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="All Incidents"
          subtitle="System-wide incident management and oversight"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 space-y-4 px-4 pb-8 lg:px-8">
          {isLoading ? (
            <>
              <StatGridSkeleton count={5} />
              <ListSkeleton count={4} />
            </>
          ) : error ? (
            <Card>
              <EmptyState icon={SearchX} title="Failed to load incidents" message="Please try again." />
            </Card>
          ) : (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <StatTile label="Total Incidents" value={incidentCounts.all} tone="muted" />
                <StatTile label="Pending" value={incidentCounts.PENDING} tone="warning" />
                <StatTile label="Investigating" value={incidentCounts.INVESTIGATING} tone="info" />
                <StatTile label="Resolved" value={incidentCounts.RESOLVED} tone="success" />
                <StatTile label="Dismissed" value={incidentCounts.DISMISSED} tone="muted" />
              </div>

              {/* Search + filter */}
              <Card>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search ticket, type, location, or reporter..."
                />
                <div className="mt-4">
                  <FilterChips
                    options={[
                      { value: 'all', label: 'All', count: incidentCounts.all },
                      ...STATUSES.map((s) => ({
                        value: s,
                        label: s.charAt(0) + s.slice(1).toLowerCase(),
                        count: incidentCounts[s],
                      })),
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                </div>
              </Card>

              {/* Incident list */}
              {filteredIncidents.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={SearchX}
                    title="No incidents found"
                    message={
                      statusFilter === 'all'
                        ? 'No incidents have been reported yet.'
                        : `No incidents with status "${statusFilter}" found.`
                    }
                  />
                </Card>
              ) : (
                <>
                  {/* Stacked cards below lg */}
                  <div className="space-y-2.5 lg:hidden">
                    {filteredIncidents.map((incident) => (
                      <Card key={incident.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink-strong">{incident.typeLabel}</p>
                            <p className="mt-1 text-sm text-ink-muted">{incident.location}</p>
                          </div>
                          <Badge label={incident.status} />
                        </div>
                        <div className="mt-3 space-y-1.5 text-sm text-ink-muted">
                          <p>{incident.description}</p>
                          <p>
                            Reported by:{' '}
                            <span className="font-medium text-ink-strong">
                              {incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : '-'}
                            </span>
                          </p>
                          <p>
                            Handled by:{' '}
                            <span className="font-medium text-ink-strong">
                              {incident.handledBy ? `${incident.handledBy.firstName} ${incident.handledBy.lastName}` : '-'}
                            </span>
                          </p>
                          <p>
                            Date:{' '}
                            <span className="font-medium text-ink-strong">
                              {new Date(incident.createdAt).toLocaleDateString()}
                            </span>
                          </p>
                          <p>
                            Ticket:{' '}
                            <span className="font-medium text-ink-strong">{incident.ticketNumber || '-'}</span>
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Table on lg+ */}
                  <Card padded={false} className="hidden overflow-x-auto lg:block">
                    <table className="min-w-full divide-y divide-surface-border">
                      <thead className="bg-surface-alt">
                        <tr>
                          {['Incident', 'Status', 'Location', 'Reported By', 'Handled By', 'Date', 'Ticket #'].map((h) => (
                            <th
                              key={h}
                              className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {filteredIncidents.map((incident) => (
                          <tr key={incident.id} className="hover:bg-surface-alt">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-ink-strong">{incident.typeLabel}</div>
                              <div className="max-w-xs truncate text-sm text-ink-muted">{incident.description}</div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge label={incident.status} />
                            </td>
                            <td className="px-6 py-4 text-sm text-ink-body">{incident.location}</td>
                            <td className="px-6 py-4 text-sm text-ink-body">
                              {incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-ink-body">
                              {incident.handledBy ? `${incident.handledBy.firstName} ${incident.handledBy.lastName}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-ink-body">
                              {new Date(incident.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-ink-body">{incident.ticketNumber || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
