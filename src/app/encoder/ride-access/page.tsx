'use client'

import { useState } from 'react'
import useSWR from 'swr'

import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'
import { authenticatedFetch } from '@/lib/api'
import { swrKey } from '@/lib/swrKeys'
import { approxMeters } from '@/lib/routing/geo'
import type { PaginationMetadata } from '@/lib/api/pagination'
import type {
  LocationCoordinatesDto,
  LocationRideAccessDto,
  PlaceVehicleAccess,
} from '@/lib/contracts'

type ReviewFilter = 'review' | 'unverified' | 'walk_only' | 'all'

const FILTERS: { value: ReviewFilter; label: string }[] = [
  { value: 'review', label: 'Needs a look' },
  { value: 'unverified', label: 'Not checked' },
  { value: 'walk_only', label: 'Walk only' },
  { value: 'all', label: 'All places' },
]

const ACCESS_OPTIONS: { value: PlaceVehicleAccess; label: string }[] = [
  { value: 'UNVERIFIED', label: 'Not checked' },
  { value: 'VEHICLE_ACCESSIBLE', label: 'Ride reaches it' },
  { value: 'WALK_ONLY', label: 'Walk only' },
]

interface RideAccessResponse {
  locations: LocationRideAccessDto[]
  pagination: PaginationMetadata
}

async function fetchRideAccess(url: string): Promise<RideAccessResponse> {
  const response = await authenticatedFetch(url)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body?.message ?? 'Could not load places.')
  }
  return body as RideAccessResponse
}

/** Accepts a "lat,lng" pair pasted straight out of a maps app. */
function parsePastedPoint(raw: string): LocationCoordinatesDto | null {
  const [latPart, lngPart] = raw.split(',')
  const lat = Number.parseFloat(latPart?.trim() ?? '')
  const lng = Number.parseFloat(lngPart?.trim() ?? '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function formatPoint(point: LocationCoordinatesDto): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
}

export default function RideAccessPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER', 'ADMIN']}>
      <RideAccessContent />
    </RoleGuard>
  )
}

function RideAccessContent() {
  const [filter, setFilter] = useState<ReviewFilter>('review')
  const { data, error, isLoading, mutate } = useSWR(
    swrKey.locationRideAccess(filter),
    fetchRideAccess,
  )

  return (
    <div className="mx-auto max-w-4xl">
      <GradientHeader
        title="Ride access"
        subtitle="Record which places a habal-habal or tricycle can actually reach"
        backHref="/encoder"
        compact
      />

      <div className="-mt-6 space-y-4 px-4 pb-8 lg:px-8">
        <div className="rounded-2xl border border-surface-border bg-surface p-4 shadow-card">
          <p className="text-sm text-ink-body">
            The fare calculator refuses to quote a trip to a pin no ride can reach. Marking a
            place here stops it guessing: a place you mark as walk only quotes to its drop-off
            instead, and the rider is told how far they walk from there. Places under{' '}
            <strong className="font-semibold text-ink-strong">Needs a look</strong> carry a
            drop-off proposed from the municipal road layer — nothing a rider sees changes
            until you confirm it.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                aria-pressed={filter === option.value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  filter === option.value
                    ? 'bg-primary text-white'
                    : 'border border-surface-border bg-surface text-ink-body hover:bg-surface-tint'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="px-1 text-sm text-ink-body">Loading places…</p>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error instanceof Error ? error.message : 'Could not load places.'}
          </div>
        ) : null}

        {data && data.locations.length === 0 ? (
          <div className="rounded-2xl border border-surface-border bg-surface px-4 py-6 text-center text-sm text-ink-body">
            {filter === 'review'
              ? 'Nothing is waiting for a decision. Switch to “All places” to revisit one.'
              : filter === 'unverified'
                ? 'Every place has been checked. Switch to “All places” to revisit one.'
                : 'No places here yet.'}
          </div>
        ) : null}

        {data?.locations.map((location) => (
          <RideAccessRow
            key={location.id}
            location={location}
            onSaved={() => void mutate()}
          />
        ))}

        {data && data.pagination.totalPages > 1 ? (
          <p className="px-1 text-xs text-ink-body">
            Showing {data.locations.length} of {data.pagination.total} places.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function RideAccessRow({
  location,
  onSaved,
}: {
  location: LocationRideAccessDto
  onSaved: () => void
}) {
  const [access, setAccess] = useState<PlaceVehicleAccess>(location.vehicleAccess)
  const [dropoffText, setDropoffText] = useState(
    location.dropoffCoordinates ? formatPoint(location.dropoffCoordinates) : '',
  )
  const [note, setNote] = useState(location.accessNote ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const dropoff = parsePastedPoint(dropoffText)
  const walkMeters = dropoff ? Math.round(approxMeters(dropoff, location.coordinates)) : null

  const save = async () => {
    setSaving(true)
    setMessage(null)
    setFailed(false)

    try {
      const response = await authenticatedFetch(
        `/api/locations/${location.id}/ride-access`,
        {
          method: 'PUT',
          body: JSON.stringify({
            vehicleAccess: access,
            dropoffCoordinates: dropoff,
            accessNote: note,
          }),
        },
      )
      const body = await response.json()

      if (!response.ok) {
        setFailed(true)
        setMessage(body?.message ?? 'Could not save ride access.')
        return
      }

      setMessage('Saved.')
      onSaved()
    } catch {
      setFailed(true)
      setMessage('Could not reach the server. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-surface-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink-strong">{location.name}</h2>
        <p className="text-xs text-ink-body">
          {location.barangay ? `${location.barangay} · ` : ''}
          {formatPoint(location.coordinates)}
        </p>
      </div>

      {/* A proposal an encoder cannot see is a proposal they cannot act on. */}
      {location.vehicleAccess !== 'WALK_ONLY' && location.dropoffCoordinates ? (
        <p className="mt-2 rounded-lg border border-dashed border-surface-border bg-surface-alt px-3 py-2 text-xs text-ink-body">
          Road data suggests a drop-off{' '}
          <strong className="font-semibold text-ink-strong">
            {Math.round(approxMeters(location.dropoffCoordinates, location.coordinates))} m
          </strong>{' '}
          away — confirm it below or replace it.
        </p>
      ) : null}

      <fieldset className="mt-3">
        <legend className="text-xs font-semibold text-ink-body">
          Can a habal-habal or tricycle reach this pin?
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACCESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setAccess(option.value)}
              aria-pressed={access === option.value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                access === option.value
                  ? 'bg-ink-strong text-white'
                  : 'border border-surface-border bg-surface text-ink-body hover:bg-surface-tint'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {access === 'WALK_ONLY' ? (
        <div className="mt-3 space-y-3 border-t border-dashed border-surface-border pt-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-body">
              Drop-off point (paste “lat, lng” from the map)
            </span>
            <input
              value={dropoffText}
              onChange={(event) => setDropoffText(event.target.value)}
              placeholder="11.281740, 125.067540"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <span className="mt-1 block text-xs text-ink-body">
              {dropoffText.trim() === ''
                ? 'Point at the gate or road end where the ride actually stops.'
                : walkMeters == null
                  ? 'That does not read as a coordinate pair.'
                  : `${walkMeters} m walk from the drop-off to ${location.name}.`}
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-ink-body">
              What the rider should know
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="Stairs from the gate to the campus."
              className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {saving ? 'Saving…' : 'Save access'}
        </button>
        {message ? (
          <span className={`text-xs ${failed ? 'text-red-700' : 'text-ink-body'}`}>
            {message}
          </span>
        ) : null}
      </div>
    </section>
  )
}
