'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { swrFetcher } from '@/lib/swr'
import type { DriverVehicleIncidentDto } from '@/app/api/driver/incidents/route'
import type { IncidentStatus } from '@/lib/contracts/incidents'

const PAGE_SIZE = 10

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'TICKET_ISSUED', label: 'Ticket Issued' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'FARE_OVERCHARGE', label: 'Fare Overcharge' },
  { value: 'FARE_UNDERCHARGE', label: 'Fare Undercharge' },
  { value: 'RECKLESS_DRIVING', label: 'Reckless Driving' },
  { value: 'VEHICLE_VIOLATION', label: 'Vehicle Violation' },
  { value: 'ROUTE_VIOLATION', label: 'Route Violation' },
  { value: 'OTHER', label: 'Other' },
]

interface DriverVehicleIncidentsResponse {
  items: DriverVehicleIncidentDto[]
  total: number
  totalPages: number
}

function buildKey(page: number, status: string, type: string, search: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (search) params.set('search', search)
  return `/api/driver/incidents?${params.toString()}`
}

function StatusBadge({ status }: { status: IncidentStatus | string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700',
    INVESTIGATING: 'bg-blue-100 text-blue-700',
    TICKET_ISSUED: 'bg-red-100 text-red-700',
    RESOLVED: 'bg-emerald-100 text-emerald-700',
    DISMISSED: 'bg-slate-100 text-slate-600',
  }
  const label: Record<string, string> = {
    PENDING: 'Pending',
    INVESTIGATING: 'Investigating',
    TICKET_ISSUED: 'Ticket Issued',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
  }
  const cls = styles[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}

export default function DriverIncidentsList() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  function handleStatusChange(val: string) {
    setStatusFilter(val)
    setPage(1)
  }

  function handleTypeChange(val: string) {
    setTypeFilter(val)
    setPage(1)
  }

  const hasActiveFilters = statusFilter !== '' || typeFilter !== '' || search !== ''

  const swrKey = buildKey(page, statusFilter, typeFilter, search)
  const { data, error, isLoading } = useSWR<DriverVehicleIncidentsResponse>(swrKey, swrFetcher)

  const errorMessage =
    error instanceof Error ? error.message : 'Unable to load incident records.'
  const items = Array.isArray(data?.items) ? data.items : []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  return (
    <section className="app-surface-card rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Vehicle Incidents</h3>
          <p className="mt-1 text-sm text-slate-500">
            Incidents reported against your currently assigned vehicle.
          </p>
        </div>
        {total > 0 ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            {total} incident{total !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search location or ticket no.…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setStatusFilter(''); setTypeFilter(''); setPage(1) }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <svg
              className="h-6 w-6 animate-spin text-emerald-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{errorMessage}</p>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-500">
              {hasActiveFilters
                ? 'No incidents match your filters.'
                : 'No incidents reported for this vehicle.'}
            </p>
            {!hasActiveFilters ? (
              <p className="mt-1 text-xs text-slate-400">
                Reports filed by passengers against your plate will appear here.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((inc) => (
              <div
                key={inc.id}
                className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{inc.typeLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{inc.location}</p>
                  </div>
                  <StatusBadge status={inc.status} />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    {new Date(inc.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {inc.plateNumber ? <span>Plate: {inc.plateNumber}</span> : null}
                  {inc.ticketNumber ? (
                    <span className="font-medium text-slate-700">Ticket #{inc.ticketNumber}</span>
                  ) : null}
                  {inc.penaltyAmount != null ? (
                    <span className="font-medium text-red-700">
                      PHP {inc.penaltyAmount.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && totalPages > 1 ? (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
