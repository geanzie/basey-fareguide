'use client'

import { useId, type KeyboardEvent } from 'react'

import { DASHBOARD_ICONS, DashboardIconSlot } from './dashboardIcons'
import { selectionLabel, type PlannerSelection } from '@/lib/planner/selection'

type Slot = 'origin' | 'destination'

interface TripFieldsProps {
  origin: PlannerSelection | null
  destination: PlannerSelection | null
  /** Which row is taking typing. Null means both read as plain text. */
  activeField: Slot | null
  /** The text in the active row. Owned by the planner, because the list filters on it. */
  query: string
  onQueryChange: (value: string) => void
  onFocusField: (slot: Slot) => void
  onClear: (slot: Slot) => void
  onSwap: () => void
  onPickOnMap: (slot: Slot) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  /** Combobox wiring for the list rendered below this block. */
  listboxId: string
  activeOptionId: string | null
  listboxExpanded: boolean
  locating?: boolean
}

/**
 * The pickup / drop-off pair, always on screen and always the way in.
 *
 * Only the focused row carries an input. Two live inputs would mean two
 * queries and an ambiguous answer to the one question the list below has to
 * ask: which end does a chosen row fill?
 */
const TripFields = ({
  origin,
  destination,
  activeField,
  query,
  onQueryChange,
  onFocusField,
  onClear,
  onSwap,
  onPickOnMap,
  onKeyDown,
  listboxId,
  activeOptionId,
  listboxExpanded,
  locating = false,
}: TripFieldsProps) => {
  const baseId = useId()
  const swapDisabled = !origin && !destination

  const rowProps = (slot: Slot) => ({
    slot,
    baseId,
    active: activeField === slot,
    query,
    onQueryChange,
    onFocus: () => onFocusField(slot),
    onClear: () => onClear(slot),
    onPickOnMap: () => onPickOnMap(slot),
    onKeyDown,
    listboxId,
    activeOptionId,
    listboxExpanded,
  })

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-1 pr-2 shadow-card">
      <div className="min-w-0 flex-1">
        <Field
          {...rowProps('origin')}
          label="Pickup"
          placeholder={locating ? 'Finding your location...' : 'Enter pickup location'}
          selection={origin}
        />
        <div className="ml-[3.25rem] h-px bg-slate-200" />
        <Field
          {...rowProps('destination')}
          label="Drop-off"
          placeholder="Enter drop-off location"
          selection={destination}
        />
      </div>

      <button
        type="button"
        onClick={onSwap}
        disabled={swapDisabled}
        aria-label="Swap pickup and drop-off"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <DashboardIconSlot icon={DASHBOARD_ICONS.refresh} size={16} />
      </button>
    </div>
  )
}

function Field({
  slot,
  baseId,
  label,
  placeholder,
  selection,
  active,
  query,
  onQueryChange,
  onFocus,
  onClear,
  onPickOnMap,
  onKeyDown,
  listboxId,
  activeOptionId,
  listboxExpanded,
}: {
  slot: Slot
  baseId: string
  label: string
  placeholder: string
  selection: PlannerSelection | null
  active: boolean
  query: string
  onQueryChange: (value: string) => void
  onFocus: () => void
  onClear: () => void
  onPickOnMap: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  listboxId: string
  activeOptionId: string | null
  listboxExpanded: boolean
}) {
  const inputId = `${baseId}-${slot}`
  const filled = Boolean(selection)
  const value = selectionLabel(selection, '')

  return (
    <div className="flex items-center gap-3 px-3">
      <span
        aria-hidden
        className={
          slot === 'origin'
            ? 'h-3 w-3 shrink-0 rounded-full bg-primary'
            : 'h-3 w-3 shrink-0 rounded-full border-[3px] border-primary-dark bg-white'
        }
      />

      {active ? (
        <>
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={listboxExpanded}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId ?? undefined}
            autoComplete="off"
            value={query}
            placeholder={filled ? value : placeholder}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
          />
        </>
      ) : (
        <button
          type="button"
          onClick={onFocus}
          className="min-w-0 flex-1 truncate py-3 text-left text-sm"
          aria-label={filled ? `${label}: ${value}. Change it.` : `Set ${label}`}
        >
          <span className={filled ? 'font-semibold text-slate-900' : 'text-slate-400'}>
            {filled ? value : placeholder}
          </span>
        </button>
      )}

      {active && query.length > 0 ? (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          aria-label="Clear what you typed"
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:text-slate-600"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={16} />
        </button>
      ) : filled ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:text-slate-600"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.close} size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPickOnMap}
          aria-label={`Pick ${label} on the map`}
          className="shrink-0 rounded-full p-1 text-primary transition hover:text-primary-dark"
        >
          <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={16} />
        </button>
      )}
    </div>
  )
}

export default TripFields
