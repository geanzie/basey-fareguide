'use client'

import { useEffect, useState } from 'react'

import type { VehicleType } from '@prisma/client'

import type {
  AdminVehicleCapacitySettingsResponseDto,
  SeatCapacityMap,
} from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

function toDraft(seatCapacities: SeatCapacityMap, types: VehicleType[]) {
  return Object.fromEntries(
    types.map((type) => [type, String(seatCapacities[type] ?? '')]),
  )
}

function vehicleTypeLabel(vehicleType: VehicleType) {
  return vehicleType
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join('-')
}

export default function AdminVehicleCapacitySettingsManager() {
  const [data, setData] = useState<AdminVehicleCapacitySettingsResponseDto | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(SWR_KEYS.adminVehicleCapacitySettings)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load vehicle seat capacity')
      }

      const nextData = payload as AdminVehicleCapacitySettingsResponseDto
      setData(nextData)
      setDraft(toDraft(nextData.seatCapacities, nextData.configurableVehicleTypes))
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load vehicle seat capacity',
      )
    } finally {
      setLoading(false)
    }
  }

  function update(vehicleType: VehicleType, value: string) {
    setSuccess(null)
    setDraft((current) => ({ ...current, [vehicleType]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!data) {
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const seatCapacities: SeatCapacityMap = {}
      for (const type of data.configurableVehicleTypes) {
        seatCapacities[type] = Number(draft[type])
      }

      const response = await fetch(SWR_KEYS.adminVehicleCapacitySettings, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCapacities }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to save vehicle seat capacity')
      }

      const saved = payload.settings as AdminVehicleCapacitySettingsResponseDto
      setData(saved)
      setDraft(toDraft(saved.seatCapacities, saved.configurableVehicleTypes))
      setSuccess(payload.message)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save vehicle seat capacity',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <p className="text-sm text-slate-600">Loading vehicle seat capacity...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <p className="text-sm text-red-600">
          {error ?? 'Vehicle seat capacity is unavailable.'}
        </p>
        <button
          type="button"
          onClick={() => void fetchSettings()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  const isDirty = data.configurableVehicleTypes.some(
    (type) => Number(draft[type]) !== (data.seatCapacities[type] ?? null),
  )

  const isValid = data.configurableVehicleTypes.every((type) => {
    const value = Number(draft[type])
    return (
      Number.isInteger(value) &&
      value >= data.minCapacity &&
      value <= data.maxCapacity
    )
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-semibold text-slate-900">Seats per vehicle type</h2>
        <p className="mt-2 text-sm text-slate-600">
          This is the number of passengers a vehicle of this type may carry, and it is
          the same for every vehicle of that type. A rider in a hurry may charter the
          whole vehicle so it leaves immediately, and this number decides both the seat
          limit and what that charter costs — the per-seat fare, times the seats.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Once the seats are full, another rider scanning this vehicle is refused a fare
          and offered a report instead. Changes take effect within a minute, on both the
          website and the mobile app. Trips already running keep the capacity they
          started with, so lowering a number never strands passengers already aboard.
        </p>

        {data.warning ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {data.warning}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.configurableVehicleTypes.map((vehicleType) => (
            <label
              key={vehicleType}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            >
              <span>{vehicleTypeLabel(vehicleType)}</span>
              <input
                type="number"
                inputMode="numeric"
                min={data.minCapacity}
                max={data.maxCapacity}
                value={draft[vehicleType] ?? ''}
                onChange={(event) => update(vehicleType, event.target.value)}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm"
              />
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Between {data.minCapacity} and {data.maxCapacity} passengers. An encoder may
          record a lower figure for one specific vehicle during registration — a
          habal-habal that safely seats two, say — but never a higher one than the
          standard set here.
        </p>

        <p className="mt-4 text-xs text-slate-500">
          {data.lastUpdatedAt
            ? `Last changed ${formatManilaDateTimeLabel(data.lastUpdatedAt)}${
                data.lastUpdatedByName ? ` by ${data.lastUpdatedByName}` : ''
              }.`
            : 'Not changed since the system default was applied.'}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <button
        type="submit"
        disabled={saving || !isDirty || !isValid}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/40"
      >
        {saving ? 'Saving...' : 'Save seat capacity'}
      </button>
    </form>
  )
}
