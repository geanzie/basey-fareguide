'use client'

import Link from 'next/link'
import type { DashboardActivityItemDto, RiderReportDto, RiderTripDto } from '@/lib/contracts'
import type { FrequentRoute } from '@/lib/rider/operationsGroups'
import { EmptyChart, timeAgo, vehicleTypeLabel } from '@/components/operations/charts'
import Badge from '@/ui/Badge'
import { formatKm, formatPesos } from './palette'

function EmptyAction({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-surface-alt p-5 text-center">
      <p className="text-sm text-ink-muted">{text}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {label}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function TripList({ trips, now, filtered }: { trips: RiderTripDto[]; now: number; filtered: boolean }) {
  if (trips.length === 0) {
    return filtered ? (
      <EmptyChart>No trip matches the current filter.</EmptyChart>
    ) : (
      <EmptyAction text="No trip recorded in this period." href="/calculator" label="Open calculator" />
    )
  }

  return (
    <ol className="flex flex-col">
      {trips.map((trip) => (
        <li key={trip.id} className="flex items-start justify-between gap-4 border-b border-surface-border py-3 last:border-b-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-strong">
              {trip.from} to {trip.to}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {vehicleTypeLabel(trip.vehicleType)}
              {trip.plateNumber ? `, ${trip.plateNumber}` : ''}, {formatKm(trip.distanceKm)}, {timeAgo(trip.at, now)}
              {trip.seatsPaid > 1 ? `, chartered for ${trip.seatsPaid}` : ''}
            </p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            <p className="text-base font-bold text-primary-dark">{formatPesos(trip.fare)}</p>
            {trip.discount > 0 ? (
              <p className="text-xs font-medium text-brandPurple">Saved {formatPesos(trip.discount)}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function ReportList({ reports, now }: { reports: RiderReportDto[]; now: number }) {
  if (reports.length === 0) {
    return <EmptyAction text="You filed no report in this period." href="/report" label="Report an incident" />
  }

  return (
    <ol className="flex flex-col">
      {reports.map((report) => (
        <li key={report.id} className="flex items-start justify-between gap-4 border-b border-surface-border py-3 last:border-b-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-strong">{report.typeLabel}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {report.location}, filed {timeAgo(report.createdAt, now)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge label={report.status} />
            {report.ticketNumber ? (
              <span className="text-xs tabular-nums text-ink-muted">Ticket {report.ticketNumber}</span>
            ) : null}
          </div>
        </li>
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
    { label: 'Reports filed', value: reportCount, className: 'text-ink-strong' },
    { label: 'Acted on', value: handledCount, className: 'text-primary-dark' },
    { label: 'Under review', value: underReviewCount, className: 'text-warning-dark' },
  ]
  return (
    <dl className="grid grid-cols-3 divide-x divide-surface-border rounded-xl bg-surface-alt">
      {cells.map((cell) => (
        <div key={cell.label} className="px-2 py-3 text-center">
          <dd className={`text-2xl font-extrabold tabular-nums ${cell.className}`}>{cell.value}</dd>
          <dt className="mt-0.5 text-xs text-ink-muted">{cell.label}</dt>
        </div>
      ))}
    </dl>
  )
}

export function EnforcementFeed({ items }: { items: DashboardActivityItemDto[] }) {
  if (items.length === 0) {
    return <EmptyChart>No enforcement action recorded yet.</EmptyChart>
  }
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-4 border-b border-surface-border py-3 last:border-b-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-strong">{item.typeLabel}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {item.location}
              {item.handledBy ? `, handled by ${item.handledBy}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge label={item.status} />
            {item.ticketNumber ? (
              <span className="text-xs tabular-nums text-ink-muted">Ticket {item.ticketNumber}</span>
            ) : null}
          </div>
        </li>
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
