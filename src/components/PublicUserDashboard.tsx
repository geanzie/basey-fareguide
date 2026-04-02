'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { flexibleFetch } from '@/lib/api'
import type {
  FareCalculationDto,
  FareCalculationsResponseDto,
  IncidentListItemDto,
  IncidentsResponseDto,
} from '@/lib/contracts'

function formatCurrency(amount: number) {
  return `PHP ${amount.toFixed(2)}`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getIncidentStatusClasses(status: string) {
  if (status === 'INVESTIGATING') {
    return 'bg-yellow-100 text-yellow-800'
  }

  if (status === 'RESOLVED') {
    return 'bg-green-100 text-green-800'
  }

  return 'bg-gray-100 text-gray-800'
}

function PublicUserDashboard() {
  const [reportedIncidents, setReportedIncidents] = useState<IncidentListItemDto[]>([])
  const [recentRoutes, setRecentRoutes] = useState<FareCalculationDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [incidentsResult, fareCalculationsResult] = await Promise.all([
          flexibleFetch<IncidentsResponseDto>('/api/incidents'),
          flexibleFetch<FareCalculationsResponseDto>('/api/fare-calculations'),
        ])

        if (incidentsResult.success && incidentsResult.data) {
          setReportedIncidents(incidentsResult.data.incidents || [])
        }

        if (fareCalculationsResult.success && fareCalculationsResult.data) {
          setRecentRoutes(fareCalculationsResult.data.calculations || [])
        }
      } finally {
        setLoading(false)
      }
    }

    void fetchUserData()
  }, [])

  const summary = useMemo(() => {
    const totalFare = recentRoutes.reduce((total, route) => total + route.fare, 0)
    const totalSavings = recentRoutes.reduce((total, route) => total + (route.discountApplied || 0), 0)

    return {
      routes: recentRoutes.length,
      reports: reportedIncidents.length,
      totalFare,
      totalSavings,
    }
  }, [recentRoutes, reportedIncidents])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/3 mb-3" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-6" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-28 rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 p-6">
        <h2 className="text-2xl font-bold text-slate-900">Your activity in Basey Fare Guide</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Start with one action, then review the latest saved fares and reported incidents below.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          href="/calculator"
          title="Calculate Fare"
          description="Plan a route or get a quick estimate."
        />
        <ActionCard
          href="/report"
          title="Report Incident"
          description="Submit one incident report with optional evidence."
          accent="red"
        />
        <ActionCard
          href="/history"
          title="View History"
          description="See all saved fares and reported incidents."
          accent="emerald"
        />
        <ActionCard
          href="/profile/discount"
          title="Manage Discount Card"
          description="Check approval status and active discount details."
          accent="violet"
        />
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Saved Routes" value={summary.routes} />
        <SummaryCard label="Incident Reports" value={summary.reports} />
        <SummaryCard label="Total Fare Logged" value={formatCurrency(summary.totalFare)} />
        <SummaryCard label="Discount Savings" value={formatCurrency(summary.totalSavings)} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white">
          <SectionHeader
            title="Recent Fare Calculations"
            description="Your latest saved planner results."
            href="/history?filter=routes"
            linkLabel="View all fares"
          />
          <div className="p-6">
            {recentRoutes.length === 0 ? (
              <EmptyState
                title="No fare calculations yet"
                description="Use the calculator to save your first route."
                href="/calculator"
                linkLabel="Open calculator"
              />
            ) : (
              <div className="space-y-4">
                {recentRoutes.slice(0, 3).map((route) => (
                  <div key={route.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {route.from} to {route.to}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {route.distanceKm.toFixed(1)} km on {formatDate(route.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        {route.originalFare !== null && route.discountApplied !== null ? (
                          <>
                            <div className="text-xs text-slate-500 line-through">
                              {formatCurrency(route.originalFare)}
                            </div>
                            <div className="text-lg font-semibold text-emerald-600">
                              {formatCurrency(route.fare)}
                            </div>
                            <div className="text-xs text-emerald-600">
                              Saved {formatCurrency(route.discountApplied)}
                            </div>
                          </>
                        ) : (
                          <div className="text-lg font-semibold text-emerald-600">
                            {formatCurrency(route.fare)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <SectionHeader
            title="Recent Incident Reports"
            description="The most recent reports you submitted."
            href="/history?filter=reports"
            linkLabel="View all reports"
          />
          <div className="p-6">
            {reportedIncidents.length === 0 ? (
              <EmptyState
                title="No incident reports yet"
                description="Submit a report when you need to flag a transport issue."
                href="/report"
                linkLabel="Report an incident"
              />
            ) : (
              <div className="space-y-4">
                {reportedIncidents.slice(0, 3).map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{incident.typeLabel}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {incident.location} on {formatDate(incident.date)}
                        </p>
                        <p className="mt-2 text-sm text-slate-700 line-clamp-2">{incident.description}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getIncidentStatusClasses(incident.status)}`}
                      >
                        {incident.statusLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function ActionCard({
  accent = 'blue',
  description,
  href,
  title,
}: {
  accent?: 'blue' | 'emerald' | 'red' | 'violet'
  description: string
  href: string
  title: string
}) {
  const accentClasses: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  }

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-5 transition hover:shadow-md ${accentClasses[accent]}`}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm opacity-80">{description}</p>
    </Link>
  )
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

function SectionHeader({
  description,
  href,
  linkLabel,
  title,
}: {
  description: string
  href: string
  linkLabel: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <Link href={href} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
        {linkLabel}
      </Link>
    </div>
  )
}

function EmptyState({
  description,
  href,
  linkLabel,
  title,
}: {
  description: string
  href: string
  linkLabel: string
  title: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

export default memo(PublicUserDashboard)
