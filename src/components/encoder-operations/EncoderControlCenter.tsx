'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import type { EncoderActivityGroup, EncoderOperationsDto, EncoderOperationsRange, EncoderQueueKind } from '@/lib/contracts'
import {
  ACTIVITY_GROUPS,
  ACTIVITY_GROUP_LABELS,
  activitySeries,
  collectionsSeries,
  eventsByVehicleType,
  matchesEvent,
  matchesQueueItem,
  outlookWeeks,
  paymentLagSummary,
  permitsByType,
  UNKNOWN_VEHICLE_TYPE,
  type EncoderFilter,
} from '@/lib/encoder/operationsGroups'
import { weekdayHourGrid } from '@/lib/operations/period'
import { swrKey } from '@/lib/swrKeys'
import { DASHBOARD_ICONS } from '@/components/dashboardIcons'
import { BarList, HourHeatGrid, Panel, StackedTrend, Swatch, vehicleTypeLabel } from '@/components/operations/charts'
import {
  FilterBar,
  LiveStatus,
  PERIOD_LABELS,
  RangePicker,
  TAB_PANEL_ID,
  TabSwitch,
  tabId,
  useDashboardTab,
  useNow,
  type DashboardTab,
} from '@/components/operations/controls'
import PageShell from '@/ui/PageShell'
import StatTile from '@/ui/StatTile'
import { SkeletonBox } from '@/ui/Skeleton'
import { TONE_HEX } from '@/ui/theme'
import { ACTIVITY_HEX, formatPesos } from './palette'
import { DeskFeed, ExpiryOutlook, PaymentLag, PermitsByType, WorkQueue } from './panels'

/** Desk work changes by the minute, not the second; half the enforcer's rate. */
const POLL_MS = 30_000
/** How long a newly arrived event keeps its "New" tag. */
const FRESH_MS = 90_000

const ACTIVITY_GROUP_SHORT_LABELS: Record<EncoderActivityGroup, string> = {
  REGISTRATIONS: 'Vehicles',
  PERMITS: 'Permits',
  STICKERS: 'Stickers',
  PAYMENTS: 'Payments',
}

const PAYMENT_ONLY = ['PAYMENTS'] as const
const PAYMENT_LABELS = { PAYMENTS: 'Collected' }
const PAYMENT_COLORS = { PAYMENTS: TONE_HEX.success }

/**
 * The encoder home page frame: brand band with the live indicator and time
 * period, the Overview / Analytics switch, then the selected view.
 */
export default function EncoderControlCenter({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  const [range, setRange] = useState<EncoderOperationsRange>('7d')
  const [status, setStatus] = useState<{ generatedAt: string | null; failed: boolean }>({
    generatedAt: null,
    failed: false,
  })
  const now = useNow()
  const [tab, changeTab] = useDashboardTab()

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      band={
        <div className="mt-3 flex flex-col gap-3">
          <LiveStatus generatedAt={status.generatedAt} failed={status.failed} now={now} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabSwitch value={tab} onChange={changeTab} />
            <RangePicker value={range} onChange={setRange} />
          </div>
        </div>
      }
    >
      <ControlCenterBody range={range} tab={tab} onStatusChange={setStatus} />
      {children}
    </PageShell>
  )
}

function ControlCenterBody({
  range,
  tab,
  onStatusChange,
}: {
  range: EncoderOperationsRange
  tab: DashboardTab
  onStatusChange: (status: { generatedAt: string | null; failed: boolean }) => void
}) {
  const { data, error } = useSWR<EncoderOperationsDto>(swrKey.encoderOperations(range), {
    refreshInterval: POLL_MS,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    keepPreviousData: true,
  })

  const [filter, setFilter] = useState<EncoderFilter>(null)
  const now = useNow()

  useEffect(() => {
    onStatusChange({ generatedAt: data?.generatedAt ?? null, failed: Boolean(error) })
  }, [data?.generatedAt, error, onStatusChange])

  // Events that arrived after the page first loaded, with when we saw them.
  const seenRef = useRef<Set<string> | null>(null)
  const [freshSince, setFreshSince] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    if (!data) return
    const ids = data.feed.map((item) => item.id)
    if (!seenRef.current) {
      seenRef.current = new Set(ids)
      return
    }
    const arrived = ids.filter((id) => !seenRef.current!.has(id))
    if (arrived.length === 0) return
    arrived.forEach((id) => seenRef.current!.add(id))
    const at = Date.now()
    setFreshSince((prev) => {
      const next = new Map(prev)
      arrived.forEach((id) => next.set(id, at))
      return next
    })
  }, [data])

  const freshIds = useMemo(
    () => new Set([...freshSince].filter(([, at]) => now - at < FRESH_MS).map(([id]) => id)),
    [freshSince, now],
  )

  const events = useMemo(() => (data?.events ?? []).filter((e) => matchesEvent(filter, e)), [data?.events, filter])
  const feed = useMemo(() => (data?.feed ?? []).filter((e) => matchesEvent(filter, e)), [data?.feed, filter])
  const queue = useMemo(() => (data?.queue ?? []).filter((q) => matchesQueueItem(filter, q)), [data?.queue, filter])

  const trendUnit = range === 'today' ? 'hour' : 'day'
  const sinceIso = data?.since
  const untilIso = data?.generatedAt
  const activity = useMemo(
    () => (sinceIso && untilIso ? activitySeries(events, new Date(sinceIso), new Date(untilIso), trendUnit) : []),
    [events, sinceIso, untilIso, trendUnit],
  )
  const collections = useMemo(
    () =>
      sinceIso && untilIso ? collectionsSeries(events, new Date(sinceIso), new Date(untilIso), trendUnit) : [],
    [events, sinceIso, untilIso, trendUnit],
  )
  const lag = useMemo(() => paymentLagSummary(events), [events])
  const heat = useMemo(() => weekdayHourGrid(events), [events])
  const registrations = useMemo(
    () => eventsByVehicleType(events.filter((event) => event.kind === 'VEHICLE_REGISTERED')),
    [events],
  )
  const permitRows = useMemo(() => permitsByType(data?.permitSnapshot ?? []), [data?.permitSnapshot])
  const weeks = useMemo(
    () =>
      outlookWeeks(
        data?.expiryOutlook ?? [],
        data ? new Date(data.generatedAt) : new Date(),
        filter?.kind === 'vehicleType' ? filter.vehicleType : null,
      ),
    [data, filter],
  )

  const groupsPresent = useMemo(() => {
    const counts = new Map<EncoderActivityGroup, number>()
    for (const event of data?.events ?? []) counts.set(event.group, (counts.get(event.group) ?? 0) + 1)
    return counts
  }, [data?.events])

  function toggle(next: Exclude<EncoderFilter, null>) {
    setFilter((current) => (JSON.stringify(current) === JSON.stringify(next) ? null : next))
  }

  if (!data && error) {
    return (
      <div className="rounded-card border border-danger-softBorder bg-danger-soft p-4 text-sm text-danger">
        Could not load the dashboard. Check your connection; the page retries on its own.
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
        <SkeletonBox className="h-[420px]" />
      </div>
    )
  }

  const { pulse } = data
  const filterLabel =
    filter?.kind === 'group'
      ? ACTIVITY_GROUP_LABELS[filter.group]
      : filter?.kind === 'vehicleType'
        ? vehicleTypeLabel(filter.vehicleType)
        : null

  const filterBar = filterLabel ? (
    <FilterBar
      label={filterLabel}
      scope={tab === 'overview' ? ' in the queue and activity.' : ' in these charts.'}
      onClear={() => setFilter(null)}
    />
  ) : null

  const truncatedNote = data.truncated ? (
    <p className="text-xs text-ink-muted">This period holds more records than the page reads at once; the oldest are left out.</p>
  ) : null

  if (tab === 'analytics') {
    const paidCount = events.filter((event) => event.kind === 'PAYMENT_RECORDED').length
    const paymentsHidden = filter?.kind === 'group' && filter.group !== 'PAYMENTS'
    return (
      <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId('analytics')} className="flex flex-col gap-4">
        {filterBar}
        {truncatedNote}
        <Panel
          title={trendUnit === 'hour' ? 'Desk activity today, by hour' : 'Desk activity over time'}
          hint="Registrations, permits, stickers and payments recorded. Hover or use the arrow keys to read each bar."
        >
          <StackedTrend
            series={activity}
            groups={ACTIVITY_GROUPS}
            labels={ACTIVITY_GROUP_LABELS}
            colors={ACTIVITY_HEX}
            unit={trendUnit}
            previousCount={filter ? null : data.previousPeriodCount}
            periodLabel={PERIOD_LABELS[range]}
            noun={['record', 'records']}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title="Collections"
            hint={`Ticket payments recorded. ${paidCount} ${paidCount === 1 ? 'ticket' : 'tickets'} paid.`}
            className="lg:col-span-2"
          >
            {paymentsHidden ? (
              <p className="py-6 text-center text-sm text-ink-muted">The current filter leaves out payments.</p>
            ) : (
              <StackedTrend
                series={collections}
                groups={PAYMENT_ONLY}
                labels={PAYMENT_LABELS}
                colors={PAYMENT_COLORS}
                unit={trendUnit}
                previousCount={filter ? null : data.previousPeriodCollected}
                periodLabel={PERIOD_LABELS[range]}
                noun={['collected', 'collected']}
                format={formatPesos}
              />
            )}
          </Panel>
          <Panel title="Time to pay" hint="From the ticket being issued to the payment.">
            <PaymentLag summary={lag} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Permits expiring ahead" hint="Active permits by week of expiry, next 12 weeks. Plan renewals here.">
            <ExpiryOutlook weeks={weeks} />
          </Panel>
          <Panel title="Permits by vehicle type" hint="Every permit on file today. Select a type to filter the page.">
            <PermitsByType
              rows={permitRows}
              activeType={filter?.kind === 'vehicleType' ? filter.vehicleType : null}
              onToggleType={(vehicleType) => toggle({ kind: 'vehicleType', vehicleType })}
            />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="New vehicles by type" hint="Vehicles registered in this period.">
            <BarList
              rows={registrations.map((entry) => ({
                key: entry.vehicleType,
                label: vehicleTypeLabel(entry.vehicleType),
                count: entry.count,
                muted: entry.vehicleType === UNKNOWN_VEHICLE_TYPE,
              }))}
              emptyText="No vehicle registered in this period."
              active={filter?.kind === 'vehicleType' ? filter.vehicleType : null}
              onToggle={(vehicleType) => toggle({ kind: 'vehicleType', vehicleType })}
            />
          </Panel>
          <Panel title="When the desk is busiest" hint="Records by day and hour, Philippine time. Use it to plan counter hours.">
            <HourHeatGrid grid={heat} noun={['record', 'records']} busyLead="Most desk work happens" />
          </Panel>
        </div>
      </div>
    )
  }

  const queueTotals: Record<EncoderQueueKind, number> = {
    UNPAID_TICKET: pulse.unpaidTicketCount,
    PERMIT_LAPSED: pulse.permitsLapsedCount,
    PERMIT_EXPIRING: pulse.permitsExpiringCount,
    STICKER_TO_PRINT: pulse.stickersToPrintCount,
    VEHICLE_NO_PERMIT: pulse.vehiclesWithoutPermitCount,
    REGISTRATION_EXPIRING: pulse.registrationsExpiringCount,
  }

  return (
    <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId('overview')} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Tickets waiting for OR"
          value={pulse.unpaidTicketCount}
          icon={DASHBOARD_ICONS.payment}
          tone={pulse.unpaidTicketCount > 0 ? 'warning' : 'success'}
          href="/encoder/ticket-payments"
          detail={pulse.unpaidTicketCount > 0 ? `${formatPesos(pulse.unpaidAmount)} unpaid` : undefined}
        />
        <StatTile
          label="Permits expiring in 30 days"
          value={pulse.permitsExpiringCount}
          icon={DASHBOARD_ICONS.permit}
          tone={pulse.permitsLapsedCount > 0 ? 'danger' : pulse.permitsExpiringCount > 0 ? 'warning' : 'success'}
          href="/encoder/permits"
          detail={pulse.permitsLapsedCount > 0 ? `${pulse.permitsLapsedCount} already past expiry` : undefined}
        />
        <StatTile
          label="Stickers to print"
          value={pulse.stickersToPrintCount}
          icon={DASHBOARD_ICONS.qrScan}
          tone={pulse.stickersToPrintCount > 0 ? 'purple' : 'success'}
          href="/encoder/permits"
          detail={pulse.permitsWithoutQrCount > 0 ? `${pulse.permitsWithoutQrCount} permits have no QR` : undefined}
        />
        <StatTile
          label="Vehicles without a permit"
          value={pulse.vehiclesWithoutPermitCount}
          icon={DASHBOARD_ICONS.vehicle}
          tone={pulse.vehiclesWithoutPermitCount > 0 ? 'info' : 'success'}
          href="/encoder/vehicles"
          detail={
            pulse.registrationsExpiringCount > 0
              ? `${pulse.registrationsExpiringCount} registrations expiring`
              : undefined
          }
        />
      </div>

      {filterBar}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Work queue"
          hint="What is waiting on the desk, most urgent first. Select a row to open the page that clears it."
          className="lg:col-span-2"
        >
          <WorkQueue items={queue} totals={queueTotals} filtered={filter !== null} now={now} />
        </Panel>

        <Panel
          title="Desk activity"
          hint={`${pulse.doneTodayCount} ${pulse.doneTodayCount === 1 ? 'record' : 'records'} today. Newest first.`}
          className="lg:max-h-[680px] lg:overflow-y-auto"
        >
          <div className="-mt-1 mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by area of work">
            {ACTIVITY_GROUPS.filter((group) => groupsPresent.has(group)).map((group) => {
              const active = filter?.kind === 'group' && filter.group === group
              return (
                <button
                  key={group}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle({ kind: 'group', group })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active
                      ? 'border-ink-strong bg-ink-strong text-white'
                      : 'border-surface-border bg-surface text-ink-body hover:border-ink-faint'
                  }`}
                >
                  <Swatch color={ACTIVITY_HEX[group]} />
                  {ACTIVITY_GROUP_SHORT_LABELS[group]}
                  <span className={`tabular-nums ${active ? 'text-white/75' : 'text-ink-muted'}`}>
                    {groupsPresent.get(group)}
                  </span>
                </button>
              )
            })}
          </div>
          <DeskFeed items={feed} freshIds={freshIds} now={now} />
        </Panel>
      </div>
      {truncatedNote}
    </div>
  )
}
