'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import type {
  EnforcerIncidentWatermarkDto,
  EnforcerOperationsDto,
  EnforcerOperationsRange,
  ViolationGroup,
} from '@/lib/contracts'
import {
  VIOLATION_GROUPS,
  VIOLATION_GROUP_LABELS,
  closeTimes,
  countByType,
  countByVehicleType,
  hourByWeekday,
  outcomeCounts,
  reportSeries,
  normalizePlaceKey,
  rankHotspots,
  repeatPlates,
  violationGroupFor,
} from '@/lib/incidents/dashboardGroups'
import { SWR_KEYS, swrKey } from '@/lib/swrKeys'
import { DASHBOARD_ICONS } from '@/components/dashboardIcons'
import PageShell from '@/ui/PageShell'
import StatTile from '@/ui/StatTile'
import { SkeletonBox } from '@/ui/Skeleton'
import type { IncidentHotspotMapHandle, MapMode } from './IncidentHotspotMap'
import { GroupSwatch, HotspotList, HourHeatGrid, LiveFeed, Panel, RepeatPlates, ViolationMix } from './panels'
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
import { CaseOutcomes, ReportTrend, TimeToClose, VehicleTypes } from './analytics'

const IncidentHotspotMap = dynamic(() => import('./IncidentHotspotMap'), {
  ssr: false,
  loading: () => <div className="h-[55vh] w-full animate-pulse bg-surface-alt lg:h-[520px]" />,
})

/** How often the new-report watermark is checked. */
const POLL_MS = 15_000
/** How long a newly arrived report keeps its "New" tag. */
const FRESH_MS = 90_000

type Filter =
  | { kind: 'group'; group: ViolationGroup }
  | { kind: 'type'; type: string }
  | { kind: 'place'; placeKey: string; label: string }
  | null

function matches(filter: Filter, item: { type: string; group: ViolationGroup; location: string }): boolean {
  if (!filter) return true
  if (filter.kind === 'group') return item.group === filter.group
  if (filter.kind === 'type') return item.type === filter.type
  return normalizePlaceKey(item.location) === filter.placeKey
}

function formatAge(iso: string | null, now: number): string {
  if (!iso) return 'None'
  const hours = (now - new Date(iso).getTime()) / 3_600_000
  if (hours < 1) return 'Under 1 h'
  if (hours < 48) return `${Math.floor(hours)} h`
  return `${Math.floor(hours / 24)} days`
}

/**
 * The enforcer home page frame: brand band with the live indicator and time
 * period, the Overview / Analytics switch, then the selected view.
 */
export default function EnforcerControlCenter({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  const [range, setRange] = useState<EnforcerOperationsRange>('7d')
  const [status, setStatus] = useState<{
    generatedAt: string | null
    failed: boolean
  }>({
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
  range: EnforcerOperationsRange
  tab: DashboardTab
  onStatusChange: (status: { generatedAt: string | null; failed: boolean }) => void
}) {
  // The full payload is heavy (every incident in range), so it is not polled.
  // Only the watermark below is live; a new report triggers one refetch.
  const { data, error, mutate } = useSWR<EnforcerOperationsDto>(swrKey.enforcerOperations(range), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
  const { data: watermark, error: watermarkError } = useSWR<EnforcerIncidentWatermarkDto>(
    SWR_KEYS.enforcerIncidentWatermark,
    {
      refreshInterval: POLL_MS,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
    },
  )

  // undefined = no watermark seen yet; the first one only sets the baseline.
  const latestIdRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!watermark) return
    const previous = latestIdRef.current
    latestIdRef.current = watermark.latestId
    if (previous !== undefined && previous !== watermark.latestId) void mutate()
  }, [watermark, mutate])

  const [filter, setFilter] = useState<Filter>(null)
  const [mapMode, setMapMode] = useState<MapMode>('hotspots')
  const now = useNow()
  const mapRef = useRef<IncidentHotspotMapHandle>(null)

  useEffect(() => {
    onStatusChange({
      generatedAt: watermark?.checkedAt ?? data?.generatedAt ?? null,
      failed: Boolean(error || watermarkError),
    })
  }, [watermark?.checkedAt, data?.generatedAt, error, watermarkError, onStatusChange])

  // Reports that arrived after the page first loaded, with when we saw them.
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

  const typeInfo = useMemo(() => new Map((data?.types ?? []).map((t) => [t.type, t])), [data?.types])
  const typeLabel = (type: string) => typeInfo.get(type)?.label ?? type
  const typeGroup = (type: string) => typeInfo.get(type)?.group ?? violationGroupFor(type)

  const records = useMemo(
    () => (data?.records ?? []).filter((r) => matches(filter, r)),
    [data?.records, filter],
  )
  const points = useMemo(() => (data?.points ?? []).filter((p) => matches(filter, p)), [data?.points, filter])
  const feed = useMemo(() => (data?.feed ?? []).filter((f) => matches(filter, f)), [data?.feed, filter])
  const locatedIds = useMemo(() => new Set((data?.points ?? []).map((p) => p.id)), [data?.points])

  // The type bars stay unfiltered by type so the enforcer can switch between
  // types; a group or place filter still narrows them.
  const typeCounts = useMemo(
    () =>
      countByType((data?.records ?? []).filter((r) => (filter?.kind === 'type' ? true : matches(filter, r)))),
    [data?.records, filter],
  )
  const heat = useMemo(() => hourByWeekday(records), [records])
  const hotspots = useMemo(() => {
    const base = filter?.kind === 'place' ? (data?.records ?? []) : records
    return rankHotspots(base)
  }, [data?.records, records, filter])
  const plates = useMemo(() => repeatPlates(records), [records])

  const trendUnit = range === 'today' ? 'hour' : 'day'
  const series = useMemo(
    () => (data ? reportSeries(records, new Date(data.since), new Date(data.generatedAt), trendUnit) : []),
    [data, records, trendUnit],
  )
  const outcomes = useMemo(() => outcomeCounts(records), [records])
  const closeSummary = useMemo(
    () => closeTimes(records, data ? new Date(data.generatedAt) : new Date()),
    [records, data],
  )
  const vehicleCounts = useMemo(() => countByVehicleType(records), [records])

  const groupsPresent = useMemo(() => {
    const counts = new Map<ViolationGroup, number>()
    for (const record of data?.records ?? []) counts.set(record.group, (counts.get(record.group) ?? 0) + 1)
    return counts
  }, [data?.records])

  const unplacedInView = records.length - points.length

  function toggle(next: Exclude<Filter, null>) {
    setFilter((current) => (JSON.stringify(current) === JSON.stringify(next) ? null : next))
  }

  function focusIncident(id: string) {
    if (mapMode !== 'pins') setMapMode('pins')
    // Let the pins layer draw before focusing a marker in it.
    window.setTimeout(() => mapRef.current?.focusIncident(id), 50)
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
        <SkeletonBox className="h-[520px]" />
      </div>
    )
  }

  const filterLabel =
    filter?.kind === 'group'
      ? VIOLATION_GROUP_LABELS[filter.group]
      : filter?.kind === 'type'
        ? typeLabel(filter.type)
        : filter?.kind === 'place'
          ? filter.label
          : null

  const filterBar = filterLabel ? (
    <FilterBar
      label={filterLabel}
      scope={tab === 'overview' ? ' on the map and feed.' : ' in these charts.'}
      onClear={() => setFilter(null)}
    />
  ) : null

  if (tab === 'analytics') {
    return (
      <div
        id={TAB_PANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId('analytics')}
        className="flex flex-col gap-4"
      >
        {filterBar}
        <Panel
          title={trendUnit === 'hour' ? 'Reports today, by hour' : 'Reports over time'}
          hint="Hover or use the arrow keys to read each bar."
        >
          <ReportTrend
            series={series}
            unit={trendUnit}
            previousCount={filter ? null : data.previousPeriodCount}
            periodLabel={PERIOD_LABELS[range]}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Case outcomes" hint="Where this period's reports stand now.">
            <CaseOutcomes outcomes={outcomes} />
          </Panel>
          <Panel title="Time to close" hint="From the report being filed to the case leaving the queue.">
            <TimeToClose summary={closeSummary} />
          </Panel>
          <Panel title="By vehicle type" hint="Which rides the reports are about.">
            <VehicleTypes counts={vehicleCounts} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="What is being reported" hint="Select a violation to filter the page.">
            <ViolationMix
              counts={typeCounts}
              types={data.types}
              activeType={filter?.kind === 'type' ? filter.type : null}
              onToggleType={(type) => toggle({ kind: 'type', type })}
            />
          </Panel>
          <Panel
            title="When it happens"
            hint="Reports by day and hour, Philippine time. Use it to plan patrols."
          >
            <HourHeatGrid grid={heat} noun={['report', 'reports']} busyLead="Most reports come in" />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Top hotspots" hint="Places with the most reports. Select one to filter.">
            <HotspotList
              hotspots={hotspots}
              typeLabel={typeLabel}
              typeGroup={typeGroup}
              activePlace={filter?.kind === 'place' ? filter.placeKey : null}
              onTogglePlace={(placeKey, label) => toggle({ kind: 'place', placeKey, label })}
            />
          </Panel>
          <Panel title="Repeat plates" hint="Vehicles reported two or more times in this period.">
            <RepeatPlates plates={plates} typeLabel={typeLabel} now={now} />
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div
      id={TAB_PANEL_ID}
      role="tabpanel"
      aria-labelledby={tabId('overview')}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="New today"
          value={data.pulse.newTodayCount}
          icon={DASHBOARD_ICONS.report}
          tone="info"
        />
        <StatTile
          label="Waiting for review"
          value={data.pulse.pendingCount}
          icon={DASHBOARD_ICONS.approval}
          tone={data.pulse.pendingCount > 0 ? 'warning' : 'success'}
          href="/enforcer/incidents"
        />
        <StatTile
          label="Tickets not yet paid"
          value={data.pulse.awaitingPaymentCount}
          icon={DASHBOARD_ICONS.payment}
          tone="purple"
        />
        <StatTile
          label="Oldest open case"
          value={formatAge(data.pulse.oldestOpenAt, now)}
          icon={DASHBOARD_ICONS.history}
          tone={
            data.pulse.oldestOpenAt && now - new Date(data.pulse.oldestOpenAt).getTime() > 3 * 86_400_000
              ? 'danger'
              : 'muted'
          }
          detail={data.pulse.referredCount > 0 ? `${data.pulse.referredCount} referred to SB` : undefined}
        />
      </div>

      {filterBar}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-card border border-surface-border bg-surface shadow-card lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <h2 className="font-brand text-lg font-bold text-ink-strong">Where reports come from</h2>
              <p className="text-xs text-ink-muted">
                {points.length} of {records.length} reports on the map
                {data.truncated ? ' (showing the most recent 5,000)' : ''}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Map view"
              className="inline-flex rounded-full bg-surface-alt p-1"
            >
              {(['hotspots', 'pins'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={mapMode === mode}
                  onClick={() => setMapMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    mapMode === mode
                      ? 'bg-white text-ink-strong shadow-card'
                      : 'text-ink-muted hover:text-ink-strong'
                  }`}
                >
                  {mode === 'hotspots' ? 'Hotspots' : 'Each report'}
                </button>
              ))}
            </div>
          </header>
          <IncidentHotspotMap ref={mapRef} points={points} mode={mapMode} />
          <footer className="flex flex-col gap-2 border-t border-surface-border px-4 py-3">
            <div className="flex flex-wrap gap-1.5" aria-label="Filter by violation group">
              {VIOLATION_GROUPS.filter((group) => groupsPresent.has(group)).map((group) => {
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
                    <GroupSwatch group={group} />
                    {VIOLATION_GROUP_LABELS[group]}
                    <span className={`tabular-nums ${active ? 'text-white/75' : 'text-ink-muted'}`}>
                      {groupsPresent.get(group)}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <GroupSwatch group="OTHER" hollow /> Dashed = placed at a barangay or landmark, not exact GPS
              </span>
              {unplacedInView > 0 ? (
                <span>{unplacedInView} reports have no usable location and are not on the map.</span>
              ) : null}
            </p>
          </footer>
        </section>

        <Panel
          title="Live feed"
          hint="Newest reports first. Select one to find it on the map."
          className="lg:max-h-[680px] lg:overflow-y-auto"
        >
          <LiveFeed
            items={feed}
            freshIds={freshIds}
            now={now}
            locatedIds={locatedIds}
            onSelect={focusIncident}
          />
        </Panel>
      </div>
    </div>
  )
}
