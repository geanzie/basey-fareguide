'use client'

import { useEffect, useState } from 'react'

import type { VehicleType } from '@prisma/client'

import type { AdminDriverSessionSettingsResponseDto } from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'
import { SWR_KEYS } from '@/lib/swrKeys'

function vehicleTypeLabel(vehicleType: VehicleType) {
  return vehicleType
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join('-')
}

export default function AdminDriverSessionSettingsManager() {
  const [data, setData] = useState<AdminDriverSessionSettingsResponseDto | null>(null)
  const [selected, setSelected] = useState<VehicleType[]>([])
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

      const response = await fetch(SWR_KEYS.adminDriverSessionSettings)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load driver session settings')
      }

      const nextData = payload as AdminDriverSessionSettingsResponseDto
      setData(nextData)
      setSelected(nextData.suspendedVehicleTypes)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Failed to load driver session settings',
      )
    } finally {
      setLoading(false)
    }
  }

  function toggle(vehicleType: VehicleType) {
    setSuccess(null)
    setSelected((current) =>
      current.includes(vehicleType)
        ? current.filter((type) => type !== vehicleType)
        : [...current, vehicleType],
    )
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
      const response = await fetch(SWR_KEYS.adminDriverSessionSettings, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Send in the server's enum order so the audit row reads consistently.
        body: JSON.stringify({
          suspendedVehicleTypes: data.availableVehicleTypes.filter((type) =>
            selected.includes(type),
          ),
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to save driver session settings')
      }

      setData(payload.settings as AdminDriverSessionSettingsResponseDto)
      setSelected((payload.settings as AdminDriverSessionSettingsResponseDto).suspendedVehicleTypes)
      setSuccess(
        payload.closedSessions > 0
          ? `${payload.message} ${payload.closedSessions} open driver session${
              payload.closedSessions === 1 ? ' was' : 's were'
            } closed.`
          : payload.message,
      )
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save driver session settings',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <p className="text-sm text-slate-600">Loading driver session settings...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <p className="text-sm text-red-600">{error ?? 'Driver session settings are unavailable.'}</p>
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

  const isDirty =
    selected.length !== data.suspendedVehicleTypes.length ||
    selected.some((type) => !data.suspendedVehicleTypes.includes(type))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-card border border-surface-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-semibold text-slate-900">Suspended vehicle types</h2>
        <p className="mt-2 text-sm text-slate-600">
          A suspended vehicle type does not use the driver app to run trips. Its drivers
          cannot go online or offline and cannot accept, board, or drop off riders.
          Instead the rider scans the permit QR printed on the vehicle and records the
          trip themselves — so the driver needs no smartphone.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Clear a vehicle type to hand trip acceptance back to its drivers. Changes take
          effect within a minute, on both the website and the mobile app.
        </p>

        {data.warning ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {data.warning}
          </p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.availableVehicleTypes.map((vehicleType) => (
            <label
              key={vehicleType}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(vehicleType)}
                onChange={() => toggle(vehicleType)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {vehicleTypeLabel(vehicleType)}
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelected([...data.availableVehicleTypes])}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Suspend all
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Resume all
          </button>
        </div>

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
        disabled={saving || !isDirty}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-primary/40"
      >
        {saving ? 'Saving...' : 'Save suspension'}
      </button>
    </form>
  )
}
