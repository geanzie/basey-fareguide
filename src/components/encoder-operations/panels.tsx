'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { EncoderEventDto, EncoderQueueItemDto, EncoderQueueKind } from '@/lib/contracts'
import {
  EVENT_KIND_LABELS,
  PERMIT_STATUSES,
  QUEUE_KINDS,
  QUEUE_KIND_LABELS,
  type PaymentLagSummary,
  type PermitStatusKey,
  type PermitTypeRow,
} from '@/lib/encoder/operationsGroups'
import { EmptyChart, Swatch, formatDayKey, timeAgo, vehicleTypeLabel } from '@/components/operations/charts'
import { TONE_HEX } from '@/ui/theme'
import { ACTIVITY_HEX, formatPesos } from './palette'

const PHONE_FEED_ROWS = 5
const DAY_MS = 86_400_000

function dayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** Whole days from `now` to `iso`; negative when `iso` is in the past. */
function daysUntil(iso: string, now: number): number {
  const diff = (new Date(iso).getTime() - now) / DAY_MS
  return diff < 0 ? -Math.ceil(-diff) : Math.floor(diff)
}

/** Why an item is in the queue, in the words of the desk. */
function dueText(item: EncoderQueueItemDto, now: number): { text: string; overdue: boolean } {
  if (!item.dueAt) return { text: 'No date on file', overdue: false }
  const days = daysUntil(item.dueAt, now)
  const ago = days === 0 ? 'today' : `${dayCount(-days)} ago`
  switch (item.kind) {
    case 'UNPAID_TICKET':
      return { text: `Ticketed ${ago}`, overdue: days <= -7 }
    case 'PERMIT_LAPSED':
      return { text: `Expired ${ago}`, overdue: true }
    case 'PERMIT_EXPIRING':
      return { text: days === 0 ? 'Expires today' : `Expires in ${dayCount(days)}`, overdue: days <= 7 }
    case 'STICKER_TO_PRINT':
      return { text: `QR issued ${ago}`, overdue: days <= -7 }
    case 'VEHICLE_NO_PERMIT':
      return { text: `Registered ${ago}`, overdue: days <= -30 }
    case 'REGISTRATION_EXPIRING':
      return days < 0
        ? { text: `Registration expired ${ago}`, overdue: true }
        : { text: days === 0 ? 'Registration expires today' : `Registration expires in ${dayCount(days)}`, overdue: days <= 7 }
  }
}

const ACTION_LABELS: Record<EncoderQueueKind, string> = {
  UNPAID_TICKET: 'Record payment',
  PERMIT_LAPSED: 'Renew or expire',
  PERMIT_EXPIRING: 'Renew',
  STICKER_TO_PRINT: 'Print sticker',
  VEHICLE_NO_PERMIT: 'Issue permit',
  REGISTRATION_EXPIRING: 'Update vehicle',
}

// ---------------------------------------------------------------------------

/**
 * Everything waiting on the encoder desk, one kind at a time. `totals` are the
 * server's full counts; `items` hold at most 25 of each kind.
 */
export function WorkQueue({
  items,
  totals,
  filtered,
  now,
}: {
  items: EncoderQueueItemDto[]
  totals: Record<EncoderQueueKind, number>
  /** True while a page filter narrows `items`; counts then come from `items`. */
  filtered: boolean
  now: number
}) {
  const shownCounts = Object.fromEntries(
    QUEUE_KINDS.map((kind) => [kind, filtered ? items.filter((item) => item.kind === kind).length : totals[kind]]),
  ) as Record<EncoderQueueKind, number>
  const firstWithWork = QUEUE_KINDS.find((kind) => shownCounts[kind] > 0) ?? QUEUE_KINDS[0]
  const [picked, setPicked] = useState<EncoderQueueKind | null>(null)
  const kind = picked ?? firstWithWork
  const rows = items.filter((item) => item.kind === kind)
  const total = QUEUE_KINDS.reduce((sum, k) => sum + shownCounts[k], 0)

  return (
    <div>
      <div role="tablist" aria-label="Kind of work" className="-mx-1 flex flex-wrap gap-1.5">
        {QUEUE_KINDS.map((k) => {
          const active = k === kind
          const count = shownCounts[k]
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPicked(k)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? 'border-ink-strong bg-ink-strong text-white'
                  : count === 0
                    ? 'border-surface-border bg-surface text-ink-faint hover:text-ink-body'
                    : 'border-surface-border bg-surface text-ink-body hover:border-ink-faint'
              }`}
            >
              {QUEUE_KIND_LABELS[k]}
              <span className={`tabular-nums ${active ? 'text-white/75' : 'text-ink-muted'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {total === 0 ? (
        <EmptyChart>Nothing is waiting on the desk{filtered ? ' for this filter' : ''}.</EmptyChart>
      ) : rows.length === 0 ? (
        <EmptyChart>No {QUEUE_KIND_LABELS[kind].toLowerCase()} right now.</EmptyChart>
      ) : (
        <ol className="mt-3 divide-y divide-surface-border" role="tabpanel">
          {rows.map((item) => {
            const due = dueText(item, now)
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-[8px] px-1.5 py-2.5 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-strong">
                      {item.plateNumber ?? 'No plate recorded'}
                      <span className="font-normal text-ink-muted">
                        {' '}
                        {vehicleTypeLabel(item.vehicleType)}
                        {item.reference && item.reference !== item.plateNumber ? `, ${item.reference}` : ''}
                      </span>
                    </span>
                    <span className={`block text-xs ${due.overdue ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
                      {due.text}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    {item.amount !== null ? (
                      <b className="text-sm tabular-nums text-ink-strong">{formatPesos(item.amount)}</b>
                    ) : null}
                    <span className="text-xs font-semibold text-primary-dark group-hover:underline">
                      {ACTION_LABELS[item.kind]}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}

      {rows.length > 0 && shownCounts[kind] > rows.length ? (
        <p className="mt-2 text-xs text-ink-muted">
          Showing the {rows.length} most urgent of {shownCounts[kind]}. The rest are on the{' '}
          <Link href={rows[0].href} className="font-semibold text-primary-dark underline">
            full list
          </Link>
          .
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function DeskFeed({
  items,
  now,
}: {
  items: EncoderEventDto[]
  now: number
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return <EmptyChart>No desk activity in this period.</EmptyChart>
  }

  return (
    <>
      <ol className="flex flex-col">
        {items.map((item, index) => {
          const collapsed = !expanded && index >= PHONE_FEED_ROWS
          return (
            <li
              key={item.id}
              className={`${collapsed ? 'hidden lg:flex' : 'flex'} items-start gap-3 border-b border-surface-border py-2.5 last:border-b-0`}
            >
              <span className="mt-1.5">
                <Swatch color={ACTIVITY_HEX[item.group]} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink-strong">{EVENT_KIND_LABELS[item.kind]}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{timeAgo(item.at, now)}</span>
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {item.plateNumber ?? 'No plate recorded'}, {vehicleTypeLabel(item.vehicleType)}
                  {item.amount !== null ? `, ${formatPesos(item.amount)}` : ''}
                </span>
              </span>
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

function formatLag(days: number): string {
  if (days < 1) return 'under a day'
  return dayCount(Math.round(days))
}

export function PaymentLag({ summary }: { summary: PaymentLagSummary }) {
  const max = Math.max(1, ...summary.buckets.map((bucket) => bucket.count))
  return (
    <div>
      {summary.medianDays === null ? (
        <p className="mb-3 text-sm text-ink-body">No ticket was paid in this period.</p>
      ) : (
        <p className="mb-3 text-sm text-ink-body">
          Half of drivers paid within <b className="text-ink-strong">{formatLag(summary.medianDays)}</b> of the
          ticket ({summary.paidCount} paid).
        </p>
      )}
      <ul className="flex flex-col gap-1.5" aria-label="Paid tickets by days to pay">
        {summary.buckets.map((bucket) => (
          <li key={bucket.label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
            <span className="text-ink-body">{bucket.label}</span>
            <span className="relative h-3 rounded-full bg-surface-alt">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary-dark"
                style={{ width: `${(bucket.count / max) * 100}%` }}
              />
            </span>
            <b className="text-right tabular-nums text-ink-strong">{bucket.count}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Permits expiring per week ahead: the renewal workload that is coming. */
export function ExpiryOutlook({ weeks }: { weeks: Array<{ weekStart: string; count: number }> }) {
  const total = weeks.reduce((sum, week) => sum + week.count, 0)
  if (total === 0) {
    return <EmptyChart>No active permit expires in the next 12 weeks.</EmptyChart>
  }
  const max = Math.max(...weeks.map((week) => week.count))
  const busiest = weeks.reduce((best, week) => (week.count > best.count ? week : best), weeks[0])

  return (
    <div>
      <p className="mb-3 text-sm text-ink-body">
        <b className="text-ink-strong">{total}</b> {total === 1 ? 'permit expires' : 'permits expire'} in the next
        12 weeks. Busiest: week of <b className="text-ink-strong">{formatDayKey(busiest.weekStart)}</b> (
        {busiest.count}).
      </p>
      <ol className="flex h-36 items-end gap-1" aria-label="Permits expiring per week">
        {weeks.map((week, index) => (
          <li
            key={week.weekStart}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`Week of ${formatDayKey(week.weekStart, true)}: ${week.count}`}
          >
            <span className="text-xs tabular-nums text-ink-muted">{week.count || ''}</span>
            <span
              className={`w-full max-w-[28px] rounded-t-[4px] ${index < 4 ? 'bg-warning' : 'bg-ink-body'}`}
              style={{ height: `${(week.count / max) * 100}%`, minHeight: week.count ? 2 : 0 }}
            />
            <span className="sr-only">
              Week of {formatDayKey(week.weekStart, true)}: {week.count}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-1 flex justify-between text-xs text-ink-muted" aria-hidden>
        <span>{formatDayKey(weeks[0].weekStart)}</span>
        <span>{formatDayKey(weeks[weeks.length - 1].weekStart)}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
        <Swatch color={TONE_HEX.warning} /> Within 30 days: already in the work queue.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

const STATUS_HEX: Record<PermitStatusKey, string> = {
  ACTIVE: TONE_HEX.success,
  EXPIRED: TONE_HEX.warning,
  SUSPENDED: TONE_HEX.purple,
  REVOKED: TONE_HEX.danger,
}

const STATUS_LABELS: Record<PermitStatusKey, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  SUSPENDED: 'Suspended',
  REVOKED: 'Revoked',
}

/** Every permit today by vehicle type, split by status. A row filters the page. */
export function PermitsByType({
  rows,
  activeType,
  onToggleType,
}: {
  rows: PermitTypeRow[]
  activeType: string | null
  onToggleType: (vehicleType: string) => void
}) {
  if (rows.length === 0) return <EmptyChart>No permits on file yet.</EmptyChart>
  const max = Math.max(...rows.map((row) => row.total))
  const present = PERMIT_STATUSES.filter((status) => rows.some((row) => row.byStatus[status] > 0))

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-body" aria-label="Legend">
        {present.map((status) => (
          <li key={status} className="inline-flex items-center gap-1.5">
            <Swatch color={STATUS_HEX[status]} />
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => {
          const active = activeType === row.vehicleType
          const dimmed = activeType !== null && !active
          return (
            <li key={row.vehicleType}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggleType(row.vehicleType)}
                title={PERMIT_STATUSES.map((s) => `${STATUS_LABELS[s]} ${row.byStatus[s]}`).join(', ')}
                className={`grid w-full grid-cols-[6.5rem_1fr_3rem] items-center gap-2 rounded-[8px] px-1 py-1 text-left text-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  dimmed ? 'opacity-40 hover:opacity-80' : 'hover:bg-surface-alt'
                }`}
              >
                <span className={active ? 'font-bold text-ink-strong' : 'text-ink-body'}>
                  {vehicleTypeLabel(row.vehicleType)}
                </span>
                <span className="flex h-3 gap-[2px]" style={{ width: `${(row.total / max) * 100}%` }}>
                  {PERMIT_STATUSES.filter((status) => row.byStatus[status] > 0).map((status) => (
                    <span
                      key={status}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(row.byStatus[status] / row.total) * 100}%`,
                        backgroundColor: STATUS_HEX[status],
                      }}
                    />
                  ))}
                </span>
                <b className="text-right tabular-nums text-ink-strong">{row.total}</b>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
