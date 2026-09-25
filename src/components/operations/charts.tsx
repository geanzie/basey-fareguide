'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { StackedBucket } from '@/lib/operations/period'

/**
 * Chart building blocks shared by the operations dashboards. Each one takes
 * its wording (the thing being counted) as props, so a chart reads "reports"
 * on the enforcer page and "payments" on the encoder page.
 */

/** Singular and plural of the thing a chart counts. */
export type Noun = readonly [one: string, many: string]

export function plural(count: number, noun: Noun): string {
  return count === 1 ? noun[0] : noun[1]
}

export function Panel({
  title,
  hint,
  action,
  children,
  className = '',
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-card border border-surface-border bg-surface shadow-card ${className}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="font-brand text-lg font-bold text-ink-strong">{title}</h2>
          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Swatch({ color, hollow = false }: { color: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
      // ponytail: category hue is data, not a theme tone — runtime hex is the point
      style={hollow ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
    />
  )
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>
}

export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

export function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRICYCLE: 'Tricycle',
  HABAL_HABAL: 'Habal-habal',
  JEEPNEY: 'Jeepney',
  MULTICAB: 'Multicab',
  BUS: 'Bus',
  VAN: 'Van',
  UNKNOWN: 'Not recorded',
}

export function vehicleTypeLabel(type: string | null): string {
  return VEHICLE_TYPE_LABELS[type ?? 'UNKNOWN'] ?? type ?? 'Not recorded'
}

/** Tracks an element's content width so SVG text stays at its real size. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Round an axis maximum up to a readable value whose half is a whole number,
 * since the midline is labeled: 4, 6, 8, 10, 20, 30, 40, 50, 60, 80, 100…
 */
export function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * power
    if (candidate >= value && candidate % 2 === 0) return candidate
  }
  return 10 * power
}

const dayLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayLabelLong = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/** Formats a Manila calendar day key (YYYY-MM-DD) without shifting it. */
export function formatDayKey(key: string, long = false): string {
  return (long ? dayLabelLong : dayLabel).format(new Date(`${key}T00:00:00Z`))
}

function bucketLabel(key: string, unit: 'day' | 'hour', long = false): string {
  if (unit === 'hour') {
    const hour = Number(key)
    return long ? `${formatHour(hour)} to ${formatHour((hour + 1) % 24)}` : formatHour(hour)
  }
  return formatDayKey(key, long)
}

const plain = (value: number) => String(value)

// ---------------------------------------------------------------------------

/**
 * Bars per day (or hour) stacked by group, with the period total and its
 * change from the previous equal period above. Hover or arrow keys read a bar.
 */
export function StackedTrend<G extends string>({
  series,
  groups,
  labels,
  colors,
  unit,
  previousCount,
  periodLabel,
  noun,
  format = plain,
}: {
  series: StackedBucket<G>[]
  groups: readonly G[]
  labels: Record<G, string>
  colors: Record<G, string>
  unit: 'day' | 'hour'
  /** Null hides the comparison (e.g. while a filter narrows `series`). */
  previousCount: number | null
  periodLabel: string
  noun: Noun
  /** Formats totals and axis values, e.g. as pesos. */
  format?: (value: number) => string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const total = series.reduce((sum, bucket) => sum + bucket.total, 0)
  const present = useMemo(
    () => groups.filter((group) => series.some((bucket) => bucket.byGroup[group] > 0)),
    [groups, series],
  )

  const height = 220
  const pad = { top: 8, right: 8, bottom: 26, left: format === plain ? 32 : 52 }
  const plotW = Math.max(0, width - pad.left - pad.right)
  const plotH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(0, ...series.map((bucket) => bucket.total)))
  const step = series.length ? plotW / series.length : 0
  const barW = Math.max(2, Math.min(28, step * 0.72))
  const y = (value: number) => pad.top + plotH - (value / max) * plotH
  const ticks = [0, max / 2, max]
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(1, Math.floor(plotW / 64))))

  let change: string
  if (previousCount === null) {
    change = 'Matching the current filter.'
  } else if (previousCount === 0) {
    change = total === 0 ? `No ${noun[1]} in this or the previous period.` : `None in the previous ${periodLabel}.`
  } else {
    const pct = Math.round(((total - previousCount) / previousCount) * 100)
    change =
      pct === 0
        ? `Same as the previous ${periodLabel} (${format(previousCount)}).`
        : `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% from ${format(previousCount)} in the previous ${periodLabel}.`
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      setActive((current) =>
        Math.min(series.length - 1, Math.max(0, (current ?? (delta > 0 ? -1 : series.length)) + delta)),
      )
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const activeBucket = active !== null ? series[active] : null
  const tooltipLeft = active !== null ? pad.left + step * active + step / 2 : 0

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-brand text-3xl font-bold tabular-nums text-ink-strong">{format(total)}</span>
        <span className="text-sm text-ink-body">
          {plural(total, noun)}. {change}
        </span>
      </div>

      {present.length > 1 ? (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-body" aria-label="Legend">
          {present.map((group) => (
            <li key={group} className="inline-flex items-center gap-1.5">
              <Swatch color={colors[group]} />
              {labels[group]}
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={ref} className="relative">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${noun[1]} per ${unit}. ${format(total)} in total. Use the left and right arrow keys to read each ${unit}.`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            onMouseLeave={() => setActive(null)}
            className="block rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? '#cbd5e1' : '#eef2f6'}
                  strokeWidth={1}
                />
                <text x={pad.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-ink-muted text-xs tabular-nums">
                  {format(tick)}
                </text>
              </g>
            ))}

            {activeBucket ? (
              <rect x={pad.left + step * active!} y={pad.top} width={step} height={plotH} fill="#f1f5f9" />
            ) : null}

            {series.map((bucket, index) => {
              const x = pad.left + step * index + (step - barW) / 2
              let base = 0
              return (
                <g key={bucket.key}>
                  {groups.map((group) => {
                    const value = bucket.byGroup[group]
                    if (!value) return null
                    const top = y(base + value)
                    const bottom = y(base)
                    base += value
                    // 2px surface gap above every segment except the topmost.
                    const gap = base < bucket.total ? 2 : 0
                    const h = Math.max(1, bottom - top - gap)
                    return (
                      <rect
                        key={group}
                        x={x}
                        y={top + gap}
                        width={barW}
                        height={h}
                        rx={Math.min(3, barW / 2)}
                        fill={colors[group]}
                      />
                    )
                  })}
                  {index % labelEvery === 0 ? (
                    <text
                      x={pad.left + step * index + step / 2}
                      y={height - 8}
                      textAnchor="middle"
                      className="fill-ink-muted text-xs"
                    >
                      {bucketLabel(bucket.key, unit)}
                    </text>
                  ) : null}
                  {/* Hit target: the whole column, not just the bar. */}
                  <rect
                    x={pad.left + step * index}
                    y={pad.top}
                    width={step}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setActive(index)}
                  />
                </g>
              )
            })}
          </svg>
        ) : (
          <div style={{ height }} />
        )}

        {activeBucket ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[10rem] -translate-x-1/2 rounded-[10px] border border-surface-border bg-surface px-3 py-2 text-xs shadow-raised"
            style={{ left: Math.min(Math.max(tooltipLeft, 80), width - 80) }}
            role="status"
          >
            <div className="font-semibold text-ink-strong">{bucketLabel(activeBucket.key, unit, true)}</div>
            <div className="mb-1 text-ink-muted">
              {format(activeBucket.total)} {plural(activeBucket.total, noun)}
            </div>
            {groups
              .filter((group) => activeBucket.byGroup[group] > 0)
              .map((group) => (
                <div key={group} className="flex items-center gap-1.5 text-ink-body">
                  <Swatch color={colors[group]} />
                  <span className="flex-1">{labels[group]}</span>
                  <b className="tabular-nums text-ink-strong">{format(activeBucket.byGroup[group])}</b>
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Sequential single-hue ramp (brand green), light to dark. */
const HEAT_STEPS = ['#f1f5f9', '#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d']

export function HourHeatGrid({
  grid,
  noun,
  busyLead,
}: {
  grid: number[][]
  noun: Noun
  /** Opens the summary sentence, e.g. "Most reports come in". */
  busyLead: string
}) {
  const max = Math.max(0, ...grid.flat())
  const peak = useMemo(() => {
    let best = { day: 0, hour: 0, count: 0 }
    grid.forEach((row, day) =>
      row.forEach((count, hour) => {
        if (count > best.count) best = { day, hour, count }
      }),
    )
    return best
  }, [grid])

  const busiestHours = useMemo(() => {
    const totals = new Array<number>(24).fill(0)
    grid.forEach((row) => row.forEach((count, hour) => (totals[hour] += count)))
    // Best consecutive 3-hour window: a shift, not a single hour.
    let bestStart = 0
    let bestSum = -1
    for (let start = 0; start < 24; start += 1) {
      const sum = totals[start] + totals[(start + 1) % 24] + totals[(start + 2) % 24]
      if (sum > bestSum) {
        bestSum = sum
        bestStart = start
      }
    }
    return { start: bestStart, sum: bestSum }
  }, [grid])

  function stepFor(count: number): string {
    if (count === 0 || max === 0) return HEAT_STEPS[0]
    const index = Math.min(HEAT_STEPS.length - 1, 1 + Math.floor((count / max) * (HEAT_STEPS.length - 2) + 0.0001))
    return HEAT_STEPS[index]
  }

  if (max === 0) {
    return <EmptyChart>No {noun[1]} in this period.</EmptyChart>
  }

  return (
    <div>
      <p className="mb-3 text-sm text-ink-body">
        {busyLead} between{' '}
        <b className="text-ink-strong">
          {formatHour(busiestHours.start)} and {formatHour((busiestHours.start + 3) % 24)}
        </b>
        . Busiest single hour: <b className="text-ink-strong">{WEEKDAYS[peak.day]} {formatHour(peak.hour)}</b>{' '}
        ({peak.count}).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-separate" style={{ borderSpacing: 2 }}>
          <caption className="sr-only">
            {noun[1][0].toUpperCase() + noun[1].slice(1)} by weekday and hour, Philippine time
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-10" />
              {Array.from({ length: 24 }, (_, hour) => (
                <th
                  key={hour}
                  scope="col"
                  className="overflow-visible whitespace-nowrap text-left text-xs font-medium text-ink-faint"
                >
                  {hour % 3 === 0 ? formatHour(hour).replace(' ', '') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, day) => (
              <tr key={day}>
                <th scope="row" className="pr-1 text-left text-xs font-medium text-ink-muted">
                  {WEEKDAYS[day]}
                </th>
                {row.map((count, hour) => (
                  <td
                    key={hour}
                    className="h-5 rounded-[4px]"
                    style={{ backgroundColor: stepFor(count) }}
                    title={`${WEEKDAYS[day]} ${formatHour(hour)}: ${count} ${plural(count, noun)}`}
                  >
                    <span className="sr-only">{count}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-xs text-ink-muted" aria-hidden>
        Fewer
        {HEAT_STEPS.map((color) => (
          <span key={color} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} />
        ))}
        More
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Horizontal bars, one per row, longest first. With `onToggle` each row is a
 * button that filters the page, and `active` marks the one in effect.
 */
export function BarList({
  rows,
  emptyText,
  active = null,
  onToggle,
  labelWidth = '6.5rem',
}: {
  rows: Array<{ key: string; label: string; count: number; muted?: boolean }>
  emptyText: string
  active?: string | null
  onToggle?: (key: string) => void
  labelWidth?: string
}) {
  if (rows.length === 0) return <EmptyChart>{emptyText}</EmptyChart>
  const max = Math.max(...rows.map((row) => row.count))
  const total = rows.reduce((sum, row) => sum + row.count, 0)

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const isActive = active === row.key
        const body = (
          <>
            <span className={`truncate text-left ${row.muted ? 'text-ink-muted' : 'text-ink-body'}`}>{row.label}</span>
            <span className="relative h-3 rounded-full bg-surface-alt">
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${
                  isActive ? 'bg-primary-dark' : row.muted ? 'bg-ink-faint' : 'bg-ink-body'
                }`}
                style={{ width: `${max ? (row.count / max) * 100 : 0}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              <b className="text-ink-strong">{row.count}</b>
              <span className="text-xs text-ink-muted"> {total ? Math.round((row.count / total) * 100) : 0}%</span>
            </span>
          </>
        )
        const grid = { gridTemplateColumns: `${labelWidth} 1fr 4rem` }
        return (
          <li key={row.key}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onToggle(row.key)}
                className={`grid w-full items-center gap-2 rounded-[8px] px-1 py-0.5 text-sm hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? 'bg-surface-tint' : ''
                }`}
                style={grid}
              >
                {body}
              </button>
            ) : (
              <div className="grid items-center gap-2 px-1 text-sm" style={grid}>
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
