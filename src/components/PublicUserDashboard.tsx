'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'

import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
  type DashboardIcon,
  type DashboardIconTone,
} from '@/components/dashboardIcons'
import FareRateBanner from '@/components/FareRateBanner'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'
import type {
  FareCalculationDto,
  FareCalculationsResponseDto,
  IncidentListItemDto,
  IncidentsResponseDto,
} from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'

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

const SECTION_ICON_TONES: Record<DashboardIconTone, string> = {
  slate: 'text-slate-500',
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  red: 'text-red-600',
  violet: 'text-violet-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
}

function PublicUserDashboard() {
  const { data: incidentsResponse, isLoading: incidentsLoading } =
    useSWR<IncidentsResponseDto>(SWR_KEYS.incidents)
  const { data: fareCalculationsResponse, isLoading: fareCalculationsLoading } =
    useSWR<FareCalculationsResponseDto>(SWR_KEYS.fareCalculations)

  const reportedIncidents: IncidentListItemDto[] = incidentsResponse?.incidents || []
  const recentRoutes: FareCalculationDto[] = fareCalculationsResponse?.calculations || []
  const loading = incidentsLoading || fareCalculationsLoading

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
              <div key={index} className="app-surface-card h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="app-surface-card-strong rounded-2xl border border-blue-200/80 p-6">
        <div className="flex items-start gap-4">
          <div className={getDashboardIconChipClasses('blue')}>
            <DashboardIconSlot
              icon={DASHBOARD_ICONS.dashboard}
              size={DASHBOARD_ICON_POLICY.sizes.hero}
              className="text-blue-700"
            />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900">Your activity in Basey Fare Guide</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Start with one action, then review your latest fares and reports.
            </p>
          </div>
        </div>
      </section>

      <TrafficAnnouncementsFeed
        title="Traffic Announcements"
        description="Newest municipal road and transport advisories for riders."
      />

      <FareRateBanner
        title="Fare Notice"
        description="Current public fare rates and the next approved increase or adjustment, when one is scheduled."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          href="/calculator"
          icon={DASHBOARD_ICONS.calculator}
          title="Calculate Fare"
          description="Plan a route or quick estimate."
        />
        <ActionCard
          href="/report"
          icon={DASHBOARD_ICONS.incidents}
          title="Report Incident"
          description="Send one report with optional evidence."
          accent="red"
        />
        <ActionCard
          href="/history"
          icon={DASHBOARD_ICONS.history}
          title="View History"
          description="Review saved fares and submitted reports."
          accent="emerald"
        />
        <ActionCard
          href="/profile/discount"
          icon={DASHBOARD_ICONS.discount}
          title="Manage Discount Card"
          description="Check your approval and active discount."
          accent="violet"
        />
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Saved Routes"
          value={summary.routes}
          icon={DASHBOARD_ICONS.routes}
          tone="blue"
        />
        <SummaryCard
          label="Incident Reports"
          value={summary.reports}
          icon={DASHBOARD_ICONS.list}
          tone="red"
        />
        <SummaryCard
          label="Total Fare Logged"
          value={formatCurrency(summary.totalFare)}
          icon={DASHBOARD_ICONS.fare}
          tone="emerald"
        />
        <SummaryCard
          label="Discount Savings"
          value={formatCurrency(summary.totalSavings)}
          icon={DASHBOARD_ICONS.discount}
          tone="violet"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="app-surface-card rounded-2xl">
          <SectionHeader
            title="Recent Fare Calculations"
            description="Latest saved planner results."
            href="/history?filter=routes"
            linkLabel="View all fares"
            icon={DASHBOARD_ICONS.routes}
            tone="blue"
          />
          <div className="p-6">
            {recentRoutes.length === 0 ? (
              <EmptyState
                title="No fare calculations yet"
                description="Use the calculator to save your first route."
                href="/calculator"
                linkLabel="Open calculator"
                icon={DASHBOARD_ICONS.routes}
                tone="blue"
              />
            ) : (
              <div className="space-y-4">
                {recentRoutes.slice(0, 3).map((route) => (
                  <div key={route.id} className="app-surface-inner rounded-xl p-4">
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

        <div className="app-surface-card rounded-2xl">
          <SectionHeader
            title="Recent Incident Reports"
            description="Most recent reports you submitted."
            href="/history?filter=reports"
            linkLabel="View all reports"
            icon={DASHBOARD_ICONS.incidents}
            tone="red"
          />
          <div className="p-6">
            {reportedIncidents.length === 0 ? (
              <EmptyState
                title="No incident reports yet"
                description="Submit a report when you need to flag a transport issue."
                href="/report"
                linkLabel="Report an incident"
                icon={DASHBOARD_ICONS.incidents}
                tone="red"
              />
            ) : (
              <div className="space-y-4">
                {reportedIncidents.slice(0, 3).map((incident) => (
                  <div key={incident.id} className="app-surface-inner rounded-xl p-4">
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
  icon,
  title,
}: {
  accent?: 'blue' | 'emerald' | 'red' | 'violet'
  description: string
  href: string
  icon?: DashboardIcon
  title: string
}) {
  const accentClasses: Record<string, string> = {
    blue: 'app-surface-card border-blue-200/80 text-blue-900',
    emerald: 'app-surface-card border-emerald-200/80 text-emerald-900',
    red: 'app-surface-card border-red-200/80 text-red-900',
    violet: 'app-surface-card border-violet-200/80 text-violet-900',
  }
  const accentTones: Record<string, DashboardIconTone> = {
    blue: 'blue',
    emerald: 'emerald',
    red: 'red',
    violet: 'violet',
  }

  return (
    <Link
      href={href}
      className={`rounded-2xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${accentClasses[accent]}`}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <div className={getDashboardIconChipClasses(accentTones[accent])}>
            <DashboardIconSlot
              icon={icon}
              size={DASHBOARD_ICON_POLICY.sizes.card}
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm opacity-80">{description}</p>
        </div>
      </div>
    </Link>
  )
}

function SummaryCard({
  icon,
  label,
  tone = 'slate',
  value,
}: {
  icon?: DashboardIcon
  label: string
  tone?: DashboardIconTone
  value: number | string
}) {
  return (
    <div className="app-surface-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        {icon ? (
          <div className={getDashboardIconChipClasses(tone)}>
            <DashboardIconSlot
              icon={icon}
              size={DASHBOARD_ICON_POLICY.sizes.card}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionHeader({
  description,
  href,
  icon,
  linkLabel,
  tone = 'slate',
  title,
}: {
  description: string
  href: string
  icon?: DashboardIcon
  linkLabel: string
  tone?: DashboardIconTone
  title: string
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-200 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          {icon ? (
            <DashboardIconSlot
              icon={icon}
              size={DASHBOARD_ICON_POLICY.sizes.section}
              className={SECTION_ICON_TONES[tone]}
            />
          ) : null}
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
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
  icon,
  linkLabel,
  tone = 'slate',
  title,
}: {
  description: string
  href: string
  icon?: DashboardIcon
  linkLabel: string
  tone?: DashboardIconTone
  title: string
}) {
  return (
    <div className="app-surface-inner rounded-xl border border-dashed border-gray-300 p-6 text-center">
      {icon ? (
        <div className="mx-auto mb-4 flex justify-center">
          <div className={getDashboardIconChipClasses(tone)}>
            <DashboardIconSlot
              icon={icon}
              size={DASHBOARD_ICON_POLICY.sizes.empty}
            />
          </div>
        </div>
      ) : null}
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

export default memo(PublicUserDashboard)
