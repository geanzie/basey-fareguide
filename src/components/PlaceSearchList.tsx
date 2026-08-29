'use client'

import { useEffect, useRef } from 'react'

import { DASHBOARD_ICONS, DashboardIconSlot } from './dashboardIcons'
import { describePlace, type PlaceOption, type PlaceRow } from '@/lib/locations/placeRows'
import type { PlannerLocationDto } from '@/lib/contracts'

interface PlaceSearchListProps {
  rows: PlaceRow[]
  options: PlaceOption[]
  isFuzzy: boolean
  searching: boolean
  query: string
  loading: boolean
  loadError: boolean
  /** Index into `options`, or -1 when nothing is highlighted. */
  activeIndex: number
  listboxId: string
  onHighlight: (index: number) => void
  onSelect: (option: PlaceOption) => void
  onPickOnMap: () => void
  onUseCurrentLocation?: () => void
  locating?: boolean
}

const CATEGORY_ICON: Record<string, keyof typeof DASHBOARD_ICONS> = {
  barangay: 'building',
  sitio: 'home',
  landmark: 'map',
}

/** DOM id for one option, so aria-activedescendant can point at it. */
export function placeOptionId(listboxId: string, key: string): string {
  return `${listboxId}-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/**
 * Recents, then everything else, then whatever the rider types over the top.
 *
 * Presentational: the row order and the option indices come from
 * buildPlaceRows, because the search field owns arrow-key focus and needs the
 * same flattened order this renders.
 */
const PlaceSearchList = ({
  rows,
  options,
  isFuzzy,
  searching,
  query,
  loading,
  loadError,
  activeIndex,
  listboxId,
  onHighlight,
  onSelect,
  onPickOnMap,
  onUseCurrentLocation,
  locating = false,
}: PlaceSearchListProps) => {
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined
  const activeId = activeOption ? placeOptionId(listboxId, activeOption.key) : null
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Keyboard navigation is useless if the highlighted row is off-screen.
  // Looked up by id rather than by selector: React's generated ids contain
  // characters a CSS selector would have to escape, and CSS.escape is not
  // everywhere.
  useEffect(() => {
    if (!activeId) return
    const element = document.getElementById(activeId)
    element?.scrollIntoView?.({ block: 'nearest' })
  }, [activeId])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {onUseCurrentLocation ? (
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={16} />
            {locating ? 'Finding your location...' : 'Use my location'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPickOnMap}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.routes} size={16} />
          Pick on the map
        </button>
      </div>

      {isFuzzy && options.length > 0 ? (
        <p className="text-xs font-medium text-slate-500">
          No exact match — did you mean one of these?
        </p>
      ) : null}

      {loading ? (
        <p className="px-1 py-6 text-sm text-slate-500">Loading places...</p>
      ) : loadError && options.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Could not load places</p>
          <p className="mt-1">Check your connection, or pick the point on the map instead.</p>
        </div>
      ) : options.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
          {searching ? (
            <>
              <p className="font-semibold text-slate-900">
                No Basey place called &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="mt-1">
                Check the spelling, or pick the point on the map — the fare is measured from
                whatever point you confirm.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-900">Search for a place</p>
              <p className="mt-1">
                Type a barangay or landmark name — the spelling does not have to be exact.
              </p>
            </>
          )}
        </div>
      ) : (
        <div ref={containerRef} className="max-h-[26rem] overflow-y-auto">
          <ul id={listboxId} role="listbox" aria-label="Places" className="space-y-1">
            {rows.map((row) => {
              if (row.type === 'header') {
                return (
                  <li
                    key={row.key}
                    role="presentation"
                    className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
                  >
                    {row.title}
                  </li>
                )
              }

              const index = options.indexOf(row)
              const isActive = index === activeIndex
              const id = placeOptionId(listboxId, row.key)

              return (
                <li key={row.key} role="presentation">
                  <button
                    id={id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => onHighlight(index)}
                    onClick={() => onSelect(row)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'border-slate-300 bg-slate-100'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-surface-tint text-primary-dark">
                      <DashboardIconSlot
                        icon={
                          row.type === 'pin'
                            ? DASHBOARD_ICONS.routes
                            : DASHBOARD_ICONS[CATEGORY_ICON[row.place.category] ?? 'map']
                        }
                        size={18}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {row.type === 'pin' ? row.point.label : row.place.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {row.type === 'pin' ? 'Dropped pin' : describePlace(row.place)}
                      </span>
                    </span>
                    {row.type === 'place' && needsResurvey(row.place) ? (
                      <span className="shrink-0 text-xs font-semibold text-amber-700">
                        Approximate
                      </span>
                    ) : null}
                    {row.recent ? (
                      <span className="shrink-0 text-xs font-medium text-slate-400">Recent</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function needsResurvey(place: PlannerLocationDto): boolean {
  return place.needsResurvey === true
}

export default PlaceSearchList
