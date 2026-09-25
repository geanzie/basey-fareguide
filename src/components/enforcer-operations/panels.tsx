'use client'

import { useMemo, useState } from 'react'
import type {
  EnforcerOperationsFeedItemDto,
  EnforcerOperationsTypeDto,
  ViolationGroup,
} from '@/lib/contracts'
import type { CountByType, Hotspot, RepeatPlate } from '@/lib/incidents/dashboardGroups'
import { formatIncidentStatusLabel } from '@/lib/serializers/incidents'
import { statusTone, TONE_BADGE_CLASSES } from '@/ui/theme'
import { GROUP_HEX } from './palette'
import { Swatch, timeAgo } from '@/components/operations/charts'

export { HourHeatGrid, Panel, timeAgo } from '@/components/operations/charts'

const PHONE_FEED_ROWS = 5

export function GroupSwatch({ group, hollow = false }: { group: ViolationGroup; hollow?: boolean }) {
  return <Swatch color={GROUP_HEX[group]} hollow={hollow} />
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_BADGE_CLASSES[statusTone(status)]}`}
    >
      {formatIncidentStatusLabel(status)}
    </span>
  )
}

// ---------------------------------------------------------------------------

export function LiveFeed({
  items,
  freshIds,
  now,
  locatedIds,
  onSelect,
}: {
  items: EnforcerOperationsFeedItemDto[]
  freshIds: ReadonlySet<string>
  now: number
  locatedIds: ReadonlySet<string>
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-muted">
        No reports match this filter yet. New reports appear here as they are filed.
      </p>
    )
  }

  return (
    <>
    <ol className="-mx-2 flex flex-col" aria-live="polite" aria-relevant="additions">
      {items.map((item, index) => {
        const located = locatedIds.has(item.id)
        const fresh = freshIds.has(item.id)
        // Phones get the first few so the charts stay within reach; the
        // desktop column scrolls instead.
        const collapsed = !expanded && index >= PHONE_FEED_ROWS
        return (
          <li key={item.id} className={collapsed ? 'hidden lg:block' : undefined}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              disabled={!located}
              className={`flex w-full items-start gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary enabled:hover:bg-surface-alt disabled:cursor-default ${
                fresh ? 'enforcer-feed-fresh' : ''
              }`}
              title={located ? 'Show on map' : 'This report has no map location'}
            >
              <span className="mt-1.5">
                <GroupSwatch group={item.group} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-strong">{item.typeLabel}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {timeAgo(item.createdAt, now)}
                  </span>
                </span>
                <span className="block truncate text-xs text-ink-body">
                  {item.location || 'No location given'}
                  {item.plateNumber ? ` · ${item.plateNumber}` : ''}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  {fresh ? <span className="text-xs font-semibold text-primary-dark">New</span> : null}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
    {!expanded && items.length > PHONE_FEED_ROWS ? (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-2 w-full rounded-full border border-surface-border py-2 text-xs font-semibold text-ink-body hover:border-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
      >
        Show {items.length - PHONE_FEED_ROWS} more
      </button>
    ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------

export function ViolationMix({
  counts,
  types,
  activeType,
  onToggleType,
}: {
  counts: CountByType[]
  types: EnforcerOperationsTypeDto[]
  activeType: string | null
  onToggleType: (type: string) => void
}) {
  const typeInfo = useMemo(() => new Map(types.map((t) => [t.type, t])), [types])
  const max = Math.max(1, ...counts.map((c) => c.count))

  if (counts.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No reports in this period.</p>
  }

  return (
    <ul className="flex flex-col gap-1">
      {counts.map((entry) => {
        const info = typeInfo.get(entry.type)
        const group = info?.group ?? 'OTHER'
        const active = activeType === entry.type
        const dimmed = activeType !== null && !active
        return (
          <li key={entry.type}>
            <button
              type="button"
              onClick={() => onToggleType(entry.type)}
              aria-pressed={active}
              className={`group grid w-full grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 rounded-[8px] px-1.5 py-1.5 text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-[minmax(0,12rem)_1fr_auto] ${
                dimmed ? 'opacity-40 hover:opacity-80' : ''
              }`}
              title={`${entry.count} reports, ${entry.open} still open. Select to filter the page.`}
            >
              <span className={`truncate text-sm ${active ? 'font-bold text-ink-strong' : 'text-ink-body'}`}>
                {info?.label ?? entry.type}
              </span>
              <span className="relative h-3 rounded-full bg-surface-alt">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(entry.count / max) * 100}%`, backgroundColor: GROUP_HEX[group] }}
                />
              </span>
              <span className="w-24 whitespace-nowrap text-right text-sm tabular-nums text-ink-strong">
                <b>{entry.count}</b>
                {entry.open > 0 ? <span className="text-xs text-ink-muted"> · {entry.open} open</span> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------

export function HotspotList({
  hotspots,
  typeLabel,
  typeGroup,
  activePlace,
  onTogglePlace,
}: {
  hotspots: Hotspot[]
  typeLabel: (type: string) => string
  typeGroup: (type: string) => ViolationGroup
  activePlace: string | null
  onTogglePlace: (placeKey: string, label: string) => void
}) {
  if (hotspots.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No named places in this period.</p>
  }
  const max = hotspots[0].count

  return (
    <ol className="flex flex-col gap-0.5">
      {hotspots.map((spot) => {
        const active = activePlace === spot.placeKey
        return (
          <li key={spot.placeKey}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onTogglePlace(spot.placeKey, spot.location)}
              className={`flex w-full items-center gap-3 rounded-[8px] px-1.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-surface-alt ${
                active ? 'bg-surface-tint' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-strong">{spot.location}</span>
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <GroupSwatch group={typeGroup(spot.topType)} />
                  Most often: {typeLabel(spot.topType)}
                </span>
              </span>
              <span className="hidden h-1.5 w-20 rounded-full bg-surface-alt sm:block" aria-hidden>
                <span
                  className="block h-full rounded-full bg-ink-faint"
                  style={{ width: `${(spot.count / max) * 100}%` }}
                />
              </span>
              <span className="w-16 text-right text-sm tabular-nums">
                <b className="text-ink-strong">{spot.count}</b>
                {spot.open > 0 ? <span className="block text-xs text-warning-dark">{spot.open} open</span> : null}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------

export function RepeatPlates({
  plates,
  typeLabel,
  now,
}: {
  plates: RepeatPlate[]
  typeLabel: (type: string) => string
  now: number
}) {
  if (plates.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        No plate was reported more than once in this period.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-muted">
          <th scope="col" className="pb-2 font-medium">Plate</th>
          <th scope="col" className="pb-2 font-medium">Most reported for</th>
          <th scope="col" className="pb-2 text-right font-medium">Reports</th>
        </tr>
      </thead>
      <tbody>
        {plates.map((plate) => (
          <tr key={plate.plate} className="border-t border-surface-border">
            <td className="py-2 pr-2">
              <span className="rounded-[6px] border border-ink-strong/20 bg-surface-alt px-1.5 py-0.5 font-semibold tracking-wide text-ink-strong">
                {plate.plate}
              </span>
            </td>
            <td className="py-2 pr-2 text-ink-body">
              {typeLabel(plate.topType)}
              <span className="block text-xs text-ink-muted">Last {timeAgo(plate.lastSeenAt, now)}</span>
            </td>
            <td className="py-2 text-right tabular-nums">
              <b className="text-ink-strong">{plate.count}</b>
              {plate.open > 0 ? <span className="block text-xs text-warning-dark">{plate.open} open</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
