'use client'

import { useEffect, useState } from 'react'

import type { AdminFareRatesResponseDto } from '@/lib/contracts'
import { formatManilaDateTimeInput, formatManilaDateTimeLabel } from '@/lib/manilaTime'

type PublishMode = 'immediate' | 'scheduled'

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

export default function AdminFareRatesManager() {
  const [data, setData] = useState<AdminFareRatesResponseDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<PublishMode>('immediate')
  const [baseFare, setBaseFare] = useState('15.00')
  const [perKmRate, setPerKmRate] = useState('3.00')
  const [effectiveAt, setEffectiveAt] = useState('')
  const [notes, setNotes] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const setupRequired = Boolean(data?.warning)

  useEffect(() => {
    void fetchFareRates()
  }, [])

  async function fetchFareRates() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/fare-rates')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to load fare rates')
      }

      const nextData = payload as AdminFareRatesResponseDto
      setData(nextData)
      setBaseFare(nextData.current.baseFare.toFixed(2))
      setPerKmRate(nextData.current.perKmRate.toFixed(2))
      setEffectiveAt(nextData.upcoming?.effectiveAt ? formatManilaDateTimeInput(nextData.upcoming.effectiveAt) : '')
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load fare rates')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/fare-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          baseFare: Number(baseFare),
          perKmRate: Number(perKmRate),
          effectiveAt: mode === 'scheduled' ? effectiveAt : undefined,
          notes,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to save fare rate')
      }

      setSuccess(payload.message || 'Fare rate saved successfully.')
      setNotes('')
      if (mode === 'immediate') {
        setEffectiveAt('')
      }
      await fetchFareRates()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save fare rate')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelUpcoming() {
    if (!data?.upcomingVersion) {
      return
    }

    setCanceling(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/fare-rates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: cancelReason,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to cancel scheduled fare rate')
      }

      setSuccess(payload.message || 'Scheduled fare rate canceled successfully.')
      setCancelReason('')
      await fetchFareRates()
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Failed to cancel scheduled fare rate')
    } finally {
      setCanceling(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading fare rate management...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {data?.warning && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.warning}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Current fare</p>
          <div className="mt-4 space-y-2 text-sm text-emerald-900">
            <div className="flex items-center justify-between">
              <span>Base fare ({data?.current.baseDistanceKm} km)</span>
              <span className="font-semibold">{formatCurrency(data?.current.baseFare ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Per additional km</span>
              <span className="font-semibold">{formatCurrency(data?.current.perKmRate ?? 0)}</span>
            </div>
            <p className="pt-2 text-xs text-emerald-700">
              Active since {formatManilaDateTimeLabel(data?.current.effectiveAt)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Upcoming fare</p>
          {data?.upcomingVersion ? (
            <div className="mt-4 space-y-2 text-sm text-blue-900">
              <div className="flex items-center justify-between">
                <span>Base fare ({data.upcomingVersion.baseDistanceKm} km)</span>
                <span className="font-semibold">{formatCurrency(data.upcomingVersion.baseFare)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Per additional km</span>
                <span className="font-semibold">{formatCurrency(data.upcomingVersion.perKmRate)}</span>
              </div>
              <p className="pt-2 text-xs text-blue-700">
                Effective {formatManilaDateTimeLabel(data.upcomingVersion.effectiveAt)}
              </p>
              <p className="text-xs text-blue-700">
                Scheduled by {data.upcomingVersion.createdByName || 'System'}.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-blue-900">No future fare update is scheduled.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Publish or Schedule a Fare Change</h2>
          <p className="mt-1 text-sm text-slate-600">
            The first 3 km remain fixed. Each save creates a new immutable version with your admin note.
          </p>
          {setupRequired && (
            <p className="mt-2 text-sm text-amber-700">
              Publishing and scheduling are disabled until the pending database migrations are applied.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="publishMode"
                  value="immediate"
                  checked={mode === 'immediate'}
                  onChange={() => setMode('immediate')}
                />
                <div>
                  <div className="font-semibold text-slate-900">Publish now</div>
                  <div className="text-xs text-slate-500">Apply the new fare immediately to future calculations.</div>
                </div>
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="publishMode"
                  value="scheduled"
                  checked={mode === 'scheduled'}
                  onChange={() => setMode('scheduled')}
                />
                <div>
                  <div className="font-semibold text-slate-900">Schedule for later</div>
                  <div className="text-xs text-slate-500">Keep one upcoming fare version queued for a future Manila time.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Base fare</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={baseFare}
                onChange={(event) => setBaseFare(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Additional fare per km</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={perKmRate}
                onChange={(event) => setPerKmRate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Base distance is fixed at <span className="font-semibold">3 km</span>.
          </div>

          {mode === 'scheduled' && (
            <label className="text-sm text-slate-700">
              <span className="mb-2 block font-medium text-slate-900">Effective date and time (Asia/Manila)</span>
              <input
                type="datetime-local"
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          )}

          <label className="text-sm text-slate-700">
            <span className="mb-2 block font-medium text-slate-900">Admin note</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              required
              placeholder="Explain why this fare version is being published or scheduled."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <button
            type="submit"
            disabled={saving || setupRequired}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? 'Saving fare rate...' : mode === 'scheduled' ? 'Save scheduled fare' : 'Publish fare now'}
          </button>
        </form>
      </section>

      {data?.upcomingVersion && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Cancel the Upcoming Fare Rate</h2>
          <p className="mt-1 text-sm text-amber-800">
            This only cancels the next scheduled fare version. Current live fares remain unchanged.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              placeholder="Optional cancellation reason"
              className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="button"
              onClick={handleCancelUpcoming}
              disabled={canceling || setupRequired}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {canceling ? 'Canceling...' : 'Cancel scheduled fare'}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Fare Rate History</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every fare change is versioned. Scheduled cancellations remain visible for audit review.
          </p>
        </div>

        <div className="space-y-3">
          {data?.history.length ? (
            data.history.map((version) => (
              <article
                key={version.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                        {version.isActive ? 'Current' : version.isUpcoming ? 'Upcoming' : version.canceledAt ? 'Canceled' : 'Historical'}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(version.baseFare)} base, {formatCurrency(version.perKmRate)} per km
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Effective {formatManilaDateTimeLabel(version.effectiveAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Created {formatManilaDateTimeLabel(version.createdAt)} by {version.createdByName || 'System'}.
                    </p>
                    <p className="mt-2 text-sm text-slate-600">{version.notes}</p>
                    {version.canceledAt && (
                      <p className="mt-2 text-sm text-amber-700">
                        Canceled {formatManilaDateTimeLabel(version.canceledAt)} by {version.canceledByName || 'System'}.
                        {version.cancellationReason ? ` Reason: ${version.cancellationReason}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">No fare rate history is available yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
