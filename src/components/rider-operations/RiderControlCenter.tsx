'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import type { DashboardActivityItemDto, RiderOperationsDto, RiderOperationsRange } from '@/lib/contracts'
import { closeTimes, outcomeCounts, type Outcome } from '@/lib/incidents/dashboardGroups'
import { weekdayHourGrid } from '@/lib/operations/period'
import {
  FARE_GROUPS,
  FARE_GROUP_LABELS,
  UNKNOWN_VEHICLE_TYPE,
  frequentRoutes,
  matchesTrip,
  savingsSeries,
  spendSeries,
  tripTotals,
  tripsByVehicleType,
  type RiderFilter,
} from '@/lib/rider/operationsGroups'
import { SWR_KEYS, swrKey } from '@/lib/swrKeys'
import { IconDiscount, IconFareCheck, IconReport, IconRoute } from '@/components/BrandIcons'
import FareRateBanner from '@/components/FareRateBanner'
import TrafficAnnouncementsFeed from '@/components/TrafficAnnouncementsFeed'
import { CaseOutcomes, TimeToClose } from '@/components/enforcer-operations/analytics'
import { BarList, HourHeatGrid, Panel, StackedTrend, vehicleTypeLabel } from '@/components/operations/charts'
import {
  FilterBar,
  StaticStatus,
  PERIOD_LABELS,
  RangePicker,
  TAB_PANEL_ID,
  TabSwitch,
  tabId,
  useDashboardTab,
  useNow,
  type DashboardTab,
} from '@/components/operations/controls'
import NavCard from '@/ui/NavCard'
import PageShell from '@/ui/PageShell'
import StatTile from '@/ui/StatTile'
import { SkeletonBox } from '@/ui/Skeleton'
import { FARE_HEX, SAVINGS_HEX, formatKm, formatPesos } from './palette'
import { CommunityCounts, EnforcementFeed, FrequentRoutes, ReportList, TripList } from './panels'

const RECENT_ROWS = 5

const SAVINGS_ONLY = ['SAVED'] as const
const SAVINGS_LABELS = { SAVED: 'Saved' }

type Status = { generatedAt: string | null; failed: boolean }

/**
 * The rider home page frame: brand band with the load time and time
 * period, the Overview / Analytics switch, then the selected view.
 */
export default function RiderControlCenter({ title, subtitle }: { title: string; subtitle: string }) {
  const [range, setRange] = useState<RiderOperationsRange>('30d')
  const [status, setStatus] = useState<Status>({ generatedAt: null, failed: false })
  const [tab, changeTab] = useDashboardTab()

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      band={
        <div className="mt-3 flex flex-col gap-3">
          <StaticStatus generatedAt={status.generatedAt} failed={status.failed} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabSwitch value={tab} onChange={changeTab} />
            <RangePicker value={range} onChange={setRange} />
          </div>
        </div>
      }
    >
      <RiderDashboardBody range={range} tab={tab} onStatusChange={setStatus} />
    </PageShell>
  )
}

export function RiderDashboardBody({
  range,
  tab,
  onStatusChange,
}: {
  range: RiderOperationsRange
  tab: DashboardTab
  onStatusChange?: (status: Status) => void
}) {
  const { data, error } = useSWR<RiderOperationsDto>(swrKey.riderOperations(range), {
    // Not live: fetched on load and on a period change only.
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
  const { data: activity } = useSWR<{ activity: DashboardActivityItemDto[] }>(
    tab === 'overview' ? SWR_KEYS.dashboardActivity : null,
  )

  const [filter, setFilter] = useState<RiderFilter>(null)
  const now = useNow()

  useEffect(() => {
    onStatusChange?.({ generatedAt: data?.generatedAt ?? null, failed: Boolean(error) })
  }, [data?.generatedAt, error, onStatusChange])

  const trips = useMemo(() => (data?.trips ?? []).filter((trip) => matchesTrip(filter, trip)), [data?.trips, filter])
  const trendUnit = range === 'today' ? 'hour' : 'day'
  const sinceIso = data?.since
  const untilIso = data?.generatedAt
  const spending = useMemo(
    () => (sinceIso && untilIso ? spendSeries(trips, new Date(sinceIso), new Date(untilIso), trendUnit) : []),
    [trips, sinceIso, untilIso, trendUnit],
  )
  const savings = useMemo(
    () => (sinceIso && untilIso ? savingsSeries(trips, new Date(sinceIso), new Date(untilIso), trendUnit) : []),
    [trips, sinceIso, untilIso, trendUnit],
  )
  const byType = useMemo(() => tripsByVehicleType(data?.trips ?? []), [data?.trips])
  const routes = useMemo(() => frequentRoutes(trips), [trips])
  const heat = useMemo(() => weekdayHourGrid(trips), [trips])
  const filteredTotals = useMemo(() => tripTotals(trips), [trips])
  const myOutcomes = useMemo(() => outcomeCounts(data?.reports ?? []), [data?.reports])
  const myCloseTimes = useMemo(
    () => closeTimes(data?.reports ?? [], untilIso ? new Date(untilIso) : new Date()),
    [data?.reports, untilIso],
  )

  if (!data && error) {
    return (
      <div className="rounded-card border border-danger-softBorder bg-danger-soft p-4 text-sm text-danger">
        Could not load your dashboard. Check your connection; the page retries on its own.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBox key={i} className="h-24" />
          ))}
        </div>
        <SkeletonBox className="h-[320px]" />
      </div>
    )
  }

  const { pulse, community } = data
  const filterBar =
    filter !== null ? (
      <FilterBar
        label={vehicleTypeLabel(filter.vehicleType)}
        scope={tab === 'overview' ? ' in your recent trips.' : ' in your trip charts.'}
        onClear={() => setFilter(null)}
      />
    ) : null
  const truncatedNote = data.truncated ? (
    <p className="text-xs text-ink-muted">
      You took more trips in this period than the page reads at once; the oldest are left out of the charts.
    </p>
  ) : null

  if (tab === 'analytics') {
    const communityOutcomes = community.outcomes as Array<{ status: Outcome; count: number }>
    return (
      <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId('analytics')} className="flex flex-col gap-4">
        {filterBar}
        {truncatedNote}
        <Panel
          title={trendUnit === 'hour' ? 'Fares paid today, by hour' : 'Fares paid over time'}
          hint={`${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}, ${formatKm(filteredTotals.distanceKm)}. Hover or use the arrow keys to read each bar.`}
        >
          <StackedTrend
            series={spending}
            groups={FARE_GROUPS}
            labels={FARE_GROUP_LABELS}
            colors={FARE_HEX}
            unit={trendUnit}
            previousCount={filter ? null : data.previousPeriodSpent}
            periodLabel={PERIOD_LABELS[range]}
            noun={['fare paid', 'fares paid']}
            format={formatPesos}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Discount savings" hint="Pesos your discount card took off each fare." className="lg:col-span-2">
            {filteredTotals.saved === 0 && (filter !== null || data.previousPeriodSaved === 0) ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                No discount applied in this period. Students, seniors and PWDs get 20% off with an approved card.
              </p>
            ) : (
              <StackedTrend
                series={savings}
                groups={SAVINGS_ONLY}
                labels={SAVINGS_LABELS}
                colors={SAVINGS_HEX}
                unit={trendUnit}
                previousCount={filter ? null : data.previousPeriodSaved}
                periodLabel={PERIOD_LABELS[range]}
                noun={['saving', 'savings']}
                format={formatPesos}
              />
            )}
          </Panel>
          <Panel title="Trips by vehicle" hint="Select a type to filter the page.">
            <BarList
              rows={byType.map((row) => ({
                key: row.vehicleType,
                label: vehicleTypeLabel(row.vehicleType),
                count: row.count,
                muted: row.vehicleType === UNKNOWN_VEHICLE_TYPE,
              }))}
              emptyText="No trip in this period."
              active={filter?.vehicleType ?? null}
              onToggle={(vehicleType) =>
                setFilter((current) => (current?.vehicleType === vehicleType ? null : { kind: 'vehicleType', vehicleType }))
              }
            />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Routes you ride most" hint="Your most repeated trips and what they cost on average.">
            <FrequentRoutes routes={routes} />
          </Panel>
          <Panel title="When you ride" hint="Trips by day and hour, Philippine time.">
            <HourHeatGrid grid={heat} noun={['trip', 'trips']} busyLead="You ride most" />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Your reports" hint="What happened to the reports you filed in this period.">
            {data.reports.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">You filed no report in this period.</p>
            ) : (
              <div className="flex flex-col gap-5">
                <CaseOutcomes outcomes={myOutcomes} />
                <TimeToClose summary={myCloseTimes} />
              </div>
            )}
          </Panel>
          <Panel
            title="Reports across Basey"
            hint={`Every report filed in this period, ${community.reportCount} in all, and how fast enforcers closed them.`}
          >
            <div className="flex flex-col gap-5">
              <CaseOutcomes outcomes={communityOutcomes} />
              <TimeToClose
                summary={{
                  closedCount: community.closedCount,
                  medianHours: community.medianCloseHours,
                  buckets: community.closeBuckets,
                  openOverAWeek: community.openOverAWeek,
                }}
              />
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  const underReview = community.outcomes.find((outcome) => outcome.status === 'PENDING')?.count ?? 0

  return (
    <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId('overview')} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Trips" value={pulse.tripCount} icon={IconRoute} tone="info" href="/history?filter=routes" />
        <StatTile label="Fares paid" value={formatPesos(pulse.spent)} icon={IconFareCheck} tone="success" />
        <StatTile label="Discount savings" value={formatPesos(pulse.saved)} icon={IconDiscount} tone="purple" />
        {/* "My" is load-bearing: the transparency panel below counts the
            whole municipality's reports. Open counts every date, not the period. */}
        <StatTile
          label="My open reports"
          value={pulse.openReportCount}
          icon={IconReport}
          tone={pulse.openReportCount > 0 ? 'warning' : 'success'}
          href="/history?filter=reports"
        />
      </div>

      <TrafficAnnouncementsFeed
        title="Traffic Announcements"
        description="Newest municipal road and transport advisories for riders."
      />

      <FareRateBanner
        title="Fare Notice"
        description="Current public fare rates and the next approved increase or adjustment, when one is scheduled."
      />

      {filterBar}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Panel
          title="Recent fare calculations"
          hint={`Your latest trips in the last ${PERIOD_LABELS[range]}.`}
          className="lg:col-span-3"
        >
          <TripList trips={trips.slice(0, RECENT_ROWS)} now={now} filtered={filter !== null} />
        </Panel>
        <Panel title="Recent incident reports" hint="Reports you filed, newest first." className="lg:col-span-2">
          <ReportList reports={data.reports.slice(0, RECENT_ROWS)} now={now} />
        </Panel>
      </div>

      <Panel
        title="Enforcement transparency"
        hint={`Reports across Basey in the last ${PERIOD_LABELS[range]}, and the latest ones enforcers acted on.`}
      >
        <div className="flex flex-col gap-3">
          <CommunityCounts
            reportCount={community.reportCount}
            handledCount={community.reportCount - underReview}
            underReviewCount={underReview}
          />
          <EnforcementFeed items={activity?.activity ?? []} />
        </div>
      </Panel>

      {truncatedNote}

      {/*
        Only destinations the bottom nav cannot reach in one tap. /calculator is
        a primary tab, and /history is carried by the stat tiles above, which
        link to it already filtered. /report and /profile/discount are demoted
        into the profile sheet on mobile, so these two are a short path rather
        than a second copy of the nav.
      */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NavCard
          href="/report"
          icon={IconReport}
          tone="red"
          title="Report Incident"
          description="Send one report with optional evidence."
        />
        <NavCard
          href="/profile/discount"
          icon={IconDiscount}
          tone="purple"
          title="Manage Discount Card"
          description="Check your approval and active discount."
        />
      </section>
    </div>
  )
}

