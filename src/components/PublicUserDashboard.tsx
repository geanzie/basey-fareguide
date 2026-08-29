'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AlertTriangle, BadgePercent, Banknote, Calculator, ClipboardList, History, Route, ShieldCheck } from 'lucide-react'

import FareRateBanner from '@/components/FareRateBanner'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'
import Badge from '@/ui/Badge'
import Card from '@/ui/Card'
import StatTile from '@/ui/StatTile'
import { StatGridSkeleton, ListSkeleton } from '@/ui/Skeleton'
import type {
  DashboardActivityItemDto,
  FareCalculationDto,
  FareCalculationsResponseDto,
  IncidentListItemDto,
  IncidentsResponseDto,
  RiderActiveTripStatusResponseDto,
} from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'

interface DashboardStatsResponse {
  stats: {
    totalIncidents: number
    pendingIncidents: number
    resolvedIncidents: number
  }
}

interface DashboardActivityResponse {
  activity: DashboardActivityItemDto[]
}

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

function PublicUserDashboard() {
  const { data: incidentsResponse, isLoading: incidentsLoading } =
    useSWR<IncidentsResponseDto>(SWR_KEYS.incidents)
  const { data: fareCalculationsResponse, isLoading: fareCalculationsLoading } =
    useSWR<FareCalculationsResponseDto>(SWR_KEYS.fareCalculations)
  const { data: activeTripData } = useSWR<RiderActiveTripStatusResponseDto>(SWR_KEYS.riderTripStatus, {
    refreshInterval: (latestData) => {
      const status = latestData?.trip?.status
      if (!status || status === 'PENDING' || status === 'ACCEPTED' || status === 'BOARDED') return 5000
      return 0
    },
  })
  const { data: dashboardStatsData, isLoading: statsLoading } =
    useSWR<DashboardStatsResponse>(SWR_KEYS.dashboardStats)
  const { data: dashboardActivityData, isLoading: activityLoading } =
    useSWR<DashboardActivityResponse>(SWR_KEYS.dashboardActivity)

  const reportedIncidents: IncidentListItemDto[] = incidentsResponse?.incidents || []
  const recentRoutes: FareCalculationDto[] = fareCalculationsResponse?.calculations || []
  const communityStats = dashboardStatsData?.stats ?? null
  const recentActivity: DashboardActivityItemDto[] = dashboardActivityData?.activity ?? []
  const loading = incidentsLoading || fareCalculationsLoading || statsLoading || activityLoading

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
        <StatGridSkeleton />
        <ListSkeleton count={3} />
      </div>
    )
  }

  const tripActive =
    activeTripData?.trip?.status === 'ACCEPTED' || activeTripData?.trip?.status === 'BOARDED'

  return (
    <div className="space-y-5">
      {/* Active trip card — mirrors mobile ActiveTripCard, polls via SWR above */}
      {activeTripData?.hasActiveTrip && activeTripData.trip ? (
        <Card className={tripActive ? 'border-primary/40 bg-surface-tint' : 'border-warning/40 bg-warning/5'}>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-[0.14em] ${
                tripActive ? 'text-primary-dark' : 'text-warning-dark'
              }`}
            >
              {activeTripData.trip.statusLabel}
            </span>
            {activeTripData.trip.vehiclePlateNumber ? (
              <span className="rounded-full border border-surface-border bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
                {activeTripData.trip.vehiclePlateNumber}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 text-sm font-medium text-ink-body">
            {activeTripData.trip.origin} → {activeTripData.trip.destination}
          </div>
          <div className="mt-0.5 text-sm font-bold text-ink-strong">
            PHP {activeTripData.trip.fare.toFixed(2)}
          </div>
        </Card>
      ) : null}

      <TrafficAnnouncementsFeed
        title="Traffic Announcements"
        description="Newest municipal road and transport advisories for riders."
      />

      <FareRateBanner
        title="Fare Notice"
        description="Current public fare rates and the next approved increase or adjustment, when one is scheduled."
      />

      {/* Quick actions */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          href="/calculator"
          icon={<Calculator className="h-5 w-5 text-primary" />}
          title="Calculate Fare"
          description="Plan a route or quick estimate."
        />
        <ActionCard
          href="/report"
          icon={<AlertTriangle className="h-5 w-5 text-danger" />}
          title="Report Incident"
          description="Send one report with optional evidence."
        />
        <ActionCard
          href="/history"
          icon={<History className="h-5 w-5 text-info" />}
          title="View History"
          description="Review saved fares and submitted reports."
        />
        <ActionCard
          href="/profile/discount"
          icon={<BadgePercent className="h-5 w-5 text-brandPurple" />}
          title="Manage Discount Card"
          description="Check your approval and active discount."
        />
      </section>

      {/* Summary stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Saved Routes" value={summary.routes} icon={Route} tone="info" />
        <StatTile label="Incident Reports" value={summary.reports} icon={ClipboardList} tone="danger" />
        <StatTile label="Total Fare Logged" value={formatCurrency(summary.totalFare)} icon={Banknote} tone="success" />
        <StatTile label="Discount Savings" value={formatCurrency(summary.totalSavings)} icon={BadgePercent} tone="purple" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <SectionHeader
            title="Recent Fare Calculations"
            description="Latest saved planner results."
            href="/history?filter=routes"
            linkLabel="View all fares"
          />
          <div className="p-4">
            {recentRoutes.length === 0 ? (
              <InlineEmpty
                title="No fare calculations yet"
                description="Use the calculator to save your first route."
                href="/calculator"
                linkLabel="Open calculator"
              />
            ) : (
              <div className="space-y-3">
                {recentRoutes.slice(0, 3).map((route) => (
                  <div key={route.id} className="rounded-xl bg-surface-alt p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-medium text-ink-strong">
                          {route.from} to {route.to}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {route.distanceKm.toFixed(1)} km on {formatDate(route.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        {route.originalFare !== null && route.discountApplied !== null ? (
                          <>
                            <div className="text-xs text-ink-faint line-through">
                              {formatCurrency(route.originalFare)}
                            </div>
                            <div className="text-lg font-bold text-primary">
                              {formatCurrency(route.fare)}
                            </div>
                            <div className="text-xs text-primary">
                              Saved {formatCurrency(route.discountApplied)}
                            </div>
                          </>
                        ) : (
                          <div className="text-lg font-bold text-primary">
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
        </Card>

        <Card padded={false}>
          <SectionHeader
            title="Recent Incident Reports"
            description="Most recent reports you submitted."
            href="/history?filter=reports"
            linkLabel="View all reports"
          />
          <div className="p-4">
            {reportedIncidents.length === 0 ? (
              <InlineEmpty
                title="No incident reports yet"
                description="Submit a report when you need to flag a transport issue."
                href="/report"
                linkLabel="Report an incident"
              />
            ) : (
              <div className="space-y-3">
                {reportedIncidents.slice(0, 3).map((incident) => (
                  <div key={incident.id} className="rounded-xl bg-surface-alt p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium text-ink-strong">{incident.typeLabel}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {incident.location} on {formatDate(incident.date)}
                        </p>
                        <p className="mt-2 text-sm text-ink-body line-clamp-2">{incident.description}</p>
                      </div>
                      <Badge label={incident.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <Card padded={false}>
        <SectionHeader
          title="Enforcement Transparency"
          description="Community-wide incident handling — see that reports are being actioned."
          href="/history?filter=reports"
          linkLabel="View your reports"
        />

        {communityStats !== null && (
          <div className="grid grid-cols-3 items-start divide-x divide-surface-border border-b border-surface-border">
            <div className="px-2 py-4 text-center">
              <p className="text-2xl font-extrabold text-ink-strong">{communityStats.totalIncidents}</p>
              <p className="mt-1 text-xs leading-tight text-ink-muted">Total Reports</p>
            </div>
            <div className="px-2 py-4 text-center">
              <p className="text-2xl font-extrabold text-primary">{communityStats.resolvedIncidents}</p>
              <p className="mt-1 text-xs leading-tight text-ink-muted">Resolved</p>
            </div>
            <div className="px-2 py-4 text-center">
              <p className="text-2xl font-extrabold text-warning-dark">{communityStats.pendingIncidents}</p>
              <p className="mt-1 text-xs leading-tight text-ink-muted">Under Review</p>
            </div>
          </div>
        )}

        <div className="p-4">
          {recentActivity.length === 0 ? (
            <InlineEmpty
              title="No enforcement activity yet"
              description="Incident actions will appear here once reports are submitted and handled."
              href="/report"
              linkLabel="Report an incident"
            />
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ActionCard({
  description,
  href,
  icon,
  title,
}: {
  description: string
  href: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-surface-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-tint">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink-strong">{title}</h3>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        </div>
      </div>
    </Link>
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
    <div className="flex flex-col gap-3 border-b border-surface-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-lg font-bold text-ink-strong">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <Link href={href} className="text-sm font-semibold text-primary hover:text-primary-dark">
        {linkLabel}
      </Link>
    </div>
  )
}

function InlineEmpty({
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
    <div className="rounded-xl border border-dashed border-surface-border bg-surface-alt p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-tint">
        <ShieldCheck className="h-6 w-6 text-primary" />
      </div>
      <h4 className="text-base font-bold text-ink-strong">{title}</h4>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

function ActivityRow({ item }: { item: DashboardActivityItemDto }) {
  return (
    <div className="rounded-xl bg-surface-alt p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-ink-strong">{item.typeLabel}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{item.location}</p>
          {item.handledBy ? (
            <p className="mt-1 text-xs text-ink-faint">Handled by {item.handledBy}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge label={item.status} />
          {item.ticketNumber ? (
            <span className="rounded-md border border-surface-border bg-surface px-2 py-0.5 font-mono text-xs text-ink-muted">
              #{item.ticketNumber}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default memo(PublicUserDashboard)
