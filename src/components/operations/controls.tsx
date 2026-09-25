'use client'

import { useEffect, useState } from 'react'
import type { OperationsRange } from '@/lib/operations/period'

/**
 * Controls shared by the operations dashboards. They sit in the PageShell
 * brand band, so they are styled for white-on-green.
 */

export const RANGES: Array<{ value: OperationsRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

/** How a period reads inside "the previous …". */
export const PERIOD_LABELS: Record<OperationsRange, string> = {
  today: 'day',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
}

export type DashboardTab = 'overview' | 'analytics'

const TABS: Array<{ value: DashboardTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'analytics', label: 'Analytics' },
]

/** Id of the element the tabs control; each view renders it as its tabpanel. */
export const TAB_PANEL_ID = 'control-center-panel'

export function tabId(tab: DashboardTab): string {
  return `control-center-tab-${tab}`
}

export function TabSwitch({
  value,
  onChange,
}: {
  value: DashboardTab
  onChange: (value: DashboardTab) => void
}) {
  return (
    <div role="tablist" aria-label="Dashboard view" className="inline-flex rounded-full bg-white/15 p-1">
      {TABS.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={tabId(tab.value)}
            aria-selected={active}
            aria-controls={TAB_PANEL_ID}
            onClick={() => onChange(tab.value)}
            className={`rounded-full px-4 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              active ? 'bg-white text-primary-dark' : 'text-white/85 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The selected tab, kept in ?tab= so Back, or a shared link, lands on the
 * same view. Read and written by hand rather than with useSearchParams, which
 * would force a Suspense boundary onto the page.
 */
export function useDashboardTab(): [DashboardTab, (next: DashboardTab) => void] {
  const [tab, setTab] = useState<DashboardTab>('overview')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'analytics') setTab('analytics')
  }, [])

  function changeTab(next: DashboardTab) {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'overview') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(window.history.state, '', url)
  }

  return [tab, changeTab]
}

/** A clock that ticks every `intervalMs`, for "x seconds ago" labels. */
export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

export function RangePicker({
  value,
  onChange,
}: {
  value: OperationsRange
  onChange: (value: OperationsRange) => void
}) {
  return (
    <div role="radiogroup" aria-label="Time period" className="inline-flex rounded-full bg-white/15 p-1">
      {RANGES.map((range) => {
        const active = range.value === value
        return (
          <button
            key={range.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(range.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              active ? 'bg-white text-primary-dark' : 'text-white/85 hover:text-white'
            }`}
          >
            {range.label}
          </button>
        )
      })}
    </div>
  )
}

export function LiveStatus({
  generatedAt,
  failed,
  now,
}: {
  generatedAt: string | null
  failed: boolean
  now: number
}) {
  const seconds = generatedAt ? Math.max(0, Math.round((now - new Date(generatedAt).getTime()) / 1000)) : null
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-white/90" role="status">
      <span
        // Re-keyed on every refresh so the ring plays once per update, not on a loop.
        key={generatedAt ?? 'none'}
        aria-hidden
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${failed ? 'bg-warning' : 'bg-green-300 enforcer-live-ping'}`}
      />
      {failed
        ? 'Connection lost. Retrying…'
        : seconds === null
          ? 'Connecting…'
          : `Live · updated ${seconds < 5 ? 'just now' : `${seconds} s ago`}`}
    </span>
  )
}

/** "Showing only X" strip with a reset, shown while a page filter is on. */
export function FilterBar({
  label,
  scope,
  onClear,
}: {
  label: string
  scope: string
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary/30 bg-surface-tint px-3 py-2 text-sm">
      <span className="text-ink-body">
        Showing only <b className="text-ink-strong">{label}</b>
        {scope} The filter applies to both tabs.
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary-dark hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Show all
      </button>
    </div>
  )
}
