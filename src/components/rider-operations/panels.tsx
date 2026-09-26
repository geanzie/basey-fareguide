'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { DashboardActivityItemDto, RiderReportDto, RiderTripDto } from '@/lib/contracts'
import type { FrequentRoute } from '@/lib/rider/operationsGroups'
import { EmptyChart, timeAgo, vehicleTypeLabel } from '@/components/operations/charts'
import { FIGURE, chipClass, formatKm, formatPesos } from './palette'

/**
 * The one empty state on the rider dashboard: a dashed well with a line of
 * direction and, when there is something to do about it, the action.
 */
export function EmptyNote({ text, href, label }: { text: string; href?: string; label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-surface-alt px-4 py-5 text-center">
      <p className="text-sm text-ink-muted">{text}</p>
      {href && label ? (
        <Link
          href={href}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {label}
        </Link>
      ) : null}
    </div>
  )
}

/**
 * Every list row on the rider dashboard has the same anatomy: two lines of
 * what it is, one line of facts, and one chip on the right that carries the
 * row's key value (the fare paid, or where a report stands).
 */
function StubRow({
  lead,
  facts,
  chip,
  indentFacts = false,
}: {
  lead: ReactNode
  facts: ReactNode
  chip: ReactNode
  /** Lines the facts up with the text after the route dots. */
  indentFacts?: boolean
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 border-b border-surface-border py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        {lead}
        <p
          className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted ${indentFacts ? 'pl-[18px]' : ''}`}
        >
          {facts}
        </p>
      </div>
      {chip}
    </li>
  )
}

function TwoLines({ first, second }: { first: ReactNode; second: ReactNode }) {
  return (
    <>
      <p className="truncate text-sm font-semibold text-ink-strong">{first}</p>
      <p className="truncate text-sm text-ink-muted">{second}</p>
    </>
  )
}

const exactTime = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
})

function When({ iso, now, prefix = '' }: { iso: string; now: number; prefix?: string }) {
  return (
    <time dateTime={iso} title={exactTime.format(new Date(iso))}>
      {prefix}
      {timeAgo(iso, now)}
    </time>
  )
}

// ---------------------------------------------------------------------------

const DISCOUNT_LABELS: Record<string, string> = {
  STUDENT: 'Student',
  SENIOR_CITIZEN: 'Senior',
  PWD: 'PWD',
}

/**
 * Origin (quiet) over destination (strong). One line each from `sm` up, with
 * the full name on hover; on a phone the chip leaves too little room, so the
 * names wrap rather than lose the part that tells two stops apart.
 */
function RouteStops({ from, to }: { from: string; to: string }) {
  return (
    <div className="grid grid-cols-[10px_minmax(0,1fr)] items-start gap-x-2">
      <span aria-hidden className="mt-1.5 h-2 w-2 justify-self-center rounded-full border-[1.5px] border-ink-faint" />
      <p className="text-sm text-ink-muted [overflow-wrap:anywhere] sm:truncate" title={from}>
        <span className="sr-only">From </span>
        {from}
      </p>
      <span aria-hidden className="mt-1.5 h-2 w-2 justify-self-center rounded-full bg-primary" />
      <p className="text-sm font-semibold text-ink-strong [overflow-wrap:anywhere] sm:truncate" title={to}>
        <span className="sr-only">to </span>
        {to}
      </p>
    </div>
  )
}

export function TripList({ trips, now, filtered }: { trips: RiderTripDto[]; now: number; filtered: boolean }) {
  if (trips.length === 0) {
    return filtered ? (
      <EmptyNote text="No trip matches the current filter." />
    ) : (
      <EmptyNote text="No trip recorded in this period." href="/calculator" label="Open calculator" />
    )
  }

  return (
    <ol className="flex flex-col">
      {trips.map((trip) => {
        const discounted = trip.discount > 0
        return (
          <StubRow
            key={trip.id}
            indentFacts
            lead={<RouteStops from={trip.from} to={trip.to} />}
            facts={
              <>
                <span>
                  {vehicleTypeLabel(trip.vehicleType)}
                  {trip.plateNumber ? <span className="tabular-nums"> {trip.plateNumber}</span> : null}
                </span>
                <span className="tabular-nums">{formatKm(trip.distanceKm)}</span>
                <When iso={trip.at} now={now} />
                {trip.seatsPaid > 1 ? <span>{trip.seatsPaid} seats</span> : null}
                {discounted ? (
                  <span className="font-semibold text-brandPurple">
                    {trip.discountType ? DISCOUNT_LABELS[trip.discountType] ?? 'Discount' : 'Discount'}, saved{' '}
                    {formatPesos(trip.discount)}
                  </span>
                ) : null}
              </>
            }
            chip={
              <span className={chipClass(discounted ? 'discount' : 'fare')}>
                <span className="sr-only">Paid </span>
                {formatPesos(trip.fare)}
              </span>
            }
          />
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------

const SHORT_STATUS: Record<string, string> = {
  REFERRED_FOR_FRANCHISE_ACTION: 'Referred',
}

function statusText(status: string): string {
  const words = (SHORT_STATUS[status] ?? status).replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const CLOSED_STATUSES = new Set(['RESOLVED', 'TICKET_ISSUED'])

function StatusChip({ status, open }: { status: string; open: boolean }) {
  const tone = open ? 'open' : CLOSED_STATUSES.has(status) ? 'closed' : 'neutral'
  return <span className={chipClass(tone)}>{statusText(status)}</span>
}

export function ReportList({ reports, now }: { reports: RiderReportDto[]; now: number }) {
  if (reports.length === 0) {
    return <EmptyNote text="You filed no report in this period." href="/report" label="Report an incident" />
  }

  return (
    <ol className="flex flex-col">
      {reports.map((report) => (
        <StubRow
          key={report.id}
          lead={<TwoLines first={report.typeLabel} second={report.location} />}
          facts={
            <>
              <When iso={report.createdAt} now={now} prefix="Filed " />
              {report.ticketNumber ? <span className="tabular-nums">Ticket {report.ticketNumber}</span> : null}
            </>
          }
          chip={<StatusChip status={report.status} open={report.open} />}
        />
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------

export function CommunityCounts({
  reportCount,
  handledCount,
  underReviewCount,
}: {
  reportCount: number
  handledCount: number
  underReviewCount: number
}) {
  const cells = [
    { label: 'Reports filed', value: reportCount, dot: 'border-[1.5px] border-ink-faint' },
    { label: 'Acted on', value: handledCount, dot: 'bg-primary' },
    { label: 'Under review', value: underReviewCount, dot: 'bg-warning' },
  ]
  return (
    <dl className="grid grid-cols-3 divide-x divide-surface-border rounded-xl border border-surface-border">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col-reverse gap-0.5 px-3 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${cell.dot}`} />
            {cell.label}
          </dt>
          <dd className={`text-xl ${FIGURE}`}>{cell.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const OPEN_STATUSES = new Set(['PENDING', 'INVESTIGATING'])

export function EnforcementFeed({ items, now }: { items: DashboardActivityItemDto[]; now: number }) {
  if (items.length === 0) {
    return <EmptyNote text="No enforcement action recorded yet." />
  }
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <StubRow
          key={item.id}
          lead={<TwoLines first={item.typeLabel} second={item.location} />}
          facts={
            <>
              <When iso={item.createdAt} now={now} prefix="Filed " />
              {item.handledBy ? <span>Handled by {item.handledBy}</span> : null}
              {item.ticketNumber ? <span className="tabular-nums">Ticket {item.ticketNumber}</span> : null}
            </>
          }
          chip={<StatusChip status={item.status} open={OPEN_STATUSES.has(item.status)} />}
        />
      ))}
    </ol>
  )
}

// ---------------------------------------------------------------------------

export function FrequentRoutes({ routes }: { routes: FrequentRoute[] }) {
  if (routes.length === 0) return <EmptyChart>No trip in this period.</EmptyChart>
  const max = Math.max(...routes.map((route) => route.count))

  return (
    <ol className="flex flex-col gap-2.5">
      {routes.map((route) => (
        <li key={route.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink-body">
              {route.from} to {route.to}
            </span>
            <span className="shrink-0 tabular-nums">
              <b className="text-ink-strong">{route.count}</b>
              <span className="text-xs text-ink-muted"> {route.count === 1 ? 'trip' : 'trips'}, avg {formatPesos(route.averageFare)}</span>
            </span>
          </div>
          <span className="mt-1 block h-2 rounded-full bg-surface-alt">
            <span
              className="block h-full rounded-full bg-ink-body"
              style={{ width: `${(route.count / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}
