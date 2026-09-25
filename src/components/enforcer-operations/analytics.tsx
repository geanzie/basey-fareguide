'use client'

import {
  VIOLATION_GROUPS,
  VIOLATION_GROUP_LABELS,
  type CloseTimeSummary,
  type Outcome,
  type SeriesBucket,
} from '@/lib/incidents/dashboardGroups'
import { formatIncidentStatusLabel } from '@/lib/serializers/incidents'
import { TONE_HEX } from '@/ui/theme'
import { GROUP_HEX } from './palette'
import { BarList, StackedTrend, vehicleTypeLabel } from '@/components/operations/charts'

export function ReportTrend({
  series,
  unit,
  previousCount,
  periodLabel,
}: {
  series: SeriesBucket[]
  unit: 'day' | 'hour'
  /** Null hides the comparison (e.g. while a filter narrows `series`). */
  previousCount: number | null
  periodLabel: string
}) {
  return (
    <StackedTrend
      series={series}
      groups={VIOLATION_GROUPS}
      labels={VIOLATION_GROUP_LABELS}
      colors={GROUP_HEX}
      unit={unit}
      previousCount={previousCount}
      periodLabel={periodLabel}
      noun={['report', 'reports']}
    />
  )
}

// ---------------------------------------------------------------------------

/**
 * Status colors come from the app's status tones, which are reserved for
 * state. Referred shares PENDING's amber in the badges, so here it borrows
 * info blue to stay distinguishable; every segment also carries a text label.
 */
const OUTCOME_HEX: Record<Outcome, string> = {
  PENDING: TONE_HEX.warning,
  TICKET_ISSUED: TONE_HEX.purple,
  REFERRED_FOR_FRANCHISE_ACTION: TONE_HEX.info,
  RESOLVED: TONE_HEX.success,
  DISMISSED: '#94a3b8',
}

export function CaseOutcomes({ outcomes }: { outcomes: Array<{ status: Outcome; count: number }> }) {
  const total = outcomes.reduce((sum, outcome) => sum + outcome.count, 0)
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No reports in this period.</p>
  }
  const present = outcomes.filter((outcome) => outcome.count > 0)
  const stillOpen = outcomes
    .filter((o) => o.status === 'PENDING' || o.status === 'TICKET_ISSUED')
    .reduce((sum, o) => sum + o.count, 0)

  return (
    <div>
      <p className="mb-3 text-sm text-ink-body">
        <b className="text-ink-strong">{Math.round((stillOpen / total) * 100)}%</b> of this period&apos;s reports
        still need enforcer action.
      </p>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {present.map((outcome) => (
          <span
            key={outcome.status}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(outcome.count / total) * 100}%`, backgroundColor: OUTCOME_HEX[outcome.status] }}
            title={`${formatIncidentStatusLabel(outcome.status)}: ${outcome.count}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {outcomes.map((outcome) => (
          <li key={outcome.status} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: OUTCOME_HEX[outcome.status] }}
            />
            <span className="flex-1 text-ink-body">{formatIncidentStatusLabel(outcome.status)}</span>
            <b className="tabular-nums text-ink-strong">{outcome.count}</b>
            <span className="w-10 text-right text-xs tabular-nums text-ink-muted">
              {Math.round((outcome.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------

function formatDuration(hours: number): string {
  if (hours < 1) return 'under 1 hour'
  if (hours < 48) return `${Math.round(hours)} hours`
  return `${Math.round(hours / 24)} days`
}

export function TimeToClose({ summary }: { summary: CloseTimeSummary }) {
  const max = Math.max(1, ...summary.buckets.map((bucket) => bucket.count))

  return (
    <div>
      {summary.medianHours === null ? (
        <p className="mb-3 text-sm text-ink-body">No case in this period has been closed yet.</p>
      ) : (
        <p className="mb-3 text-sm text-ink-body">
          Half of closed cases took <b className="text-ink-strong">{formatDuration(summary.medianHours)}</b> or less
          from report to resolution, dismissal or referral ({summary.closedCount} closed).
        </p>
      )}
      <ul className="flex flex-col gap-1.5" aria-label="Closed cases by time taken">
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
      {summary.openOverAWeek > 0 ? (
        <p className="mt-3 rounded-[8px] bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger">
          {summary.openOverAWeek} open {summary.openOverAWeek === 1 ? 'case was' : 'cases were'} reported more than a
          week ago.
        </p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------

export function VehicleTypes({ counts }: { counts: Array<{ vehicleType: string; count: number }> }) {
  return (
    <BarList
      rows={counts.map((entry) => ({
        key: entry.vehicleType,
        label: vehicleTypeLabel(entry.vehicleType),
        count: entry.count,
        muted: entry.vehicleType === 'UNKNOWN',
      }))}
      emptyText="No reports in this period."
    />
  )
}
