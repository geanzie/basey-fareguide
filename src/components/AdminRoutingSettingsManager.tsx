'use client'

import { useEffect, useState } from 'react'

import type {
  AdminRoutingSettingsResponseDto,
  RoutingPrimaryProviderDto,
} from '@/lib/contracts'
import { formatManilaDateTimeLabel } from '@/lib/manilaTime'

function getProviderLabel(provider: RoutingPrimaryProviderDto) {
  return provider === 'google_routes' ? 'Google Routes' : 'OpenRouteService'
}

export default function AdminRoutingSettingsManager() {
  const [data, setData] = useState<AdminRoutingSettingsResponseDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<RoutingPrimaryProviderDto>('ors')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/settings/routing')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to load routing settings')
      }

      const nextData = payload as AdminRoutingSettingsResponseDto
      setData(nextData)
      setSelectedProvider(nextData.primaryProvider)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load routing settings')
    } finally {
      setLoading(false)
    }
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
      const response = await fetch('/api/admin/settings/routing', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryProvider: selectedProvider,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.message || payload.error || 'Failed to save routing settings')
      }

      const nextData = payload.settings as AdminRoutingSettingsResponseDto
      setData(nextData)
      setSelectedProvider(nextData.primaryProvider)
      setSuccess(payload.message || 'Routing provider setting saved successfully.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save routing settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <p className="text-sm text-slate-500">Loading routing settings...</p>
      </div>
    )
  }

  const setupRequired = Boolean(data?.warning)
  const hasPendingChange = Boolean(data && selectedProvider !== data.primaryProvider)

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
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Primary provider</p>
          <p className="mt-4 text-lg font-semibold text-sky-950">
            {data ? getProviderLabel(data.primaryProvider) : 'Unavailable'}
          </p>
          <p className="mt-2 text-sm text-sky-800">{data?.fallbackDescription}</p>
          <p className="mt-2 text-xs text-sky-700">
            Secondary provider: {data ? getProviderLabel(data.fallbackProvider) : 'Unavailable'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Configuration audit</p>
          <div className="mt-4 space-y-2 text-sm text-slate-800">
            <div className="flex items-center justify-between gap-4">
              <span>Last updated by</span>
              <span className="font-medium text-slate-950">
                {data?.lastUpdatedByName || (data?.source === 'environment_default' ? 'Not saved yet' : 'System')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Last updated at</span>
              <span className="font-medium text-slate-950">
                {data?.lastUpdatedAt ? formatManilaDateTimeLabel(data.lastUpdatedAt) : 'Not saved yet'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Source</span>
              <span className="font-medium text-slate-950">
                {data?.source === 'database' ? 'Admin setting' : 'Environment default'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="app-surface-card rounded-2xl p-6">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-900">Primary routing provider</h2>
          <p className="mt-1 text-sm text-slate-600">
            Choose which routing service the server tries first for new route calculations.
          </p>
          {setupRequired && (
            <p className="mt-2 text-sm text-amber-700">
              Saving is disabled until the pending database migrations are applied.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  id="routing-provider-ors"
                  type="radio"
                  name="primaryProvider"
                  value="ors"
                  checked={selectedProvider === 'ors'}
                  onChange={() => setSelectedProvider('ors')}
                  disabled={setupRequired || saving}
                />
                <div>
                  <div className="font-semibold text-slate-900">OpenRouteService</div>
                  <div className="text-xs text-slate-500">Current default road-routing provider.</div>
                </div>
              </div>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <input
                  id="routing-provider-google"
                  type="radio"
                  name="primaryProvider"
                  value="google_routes"
                  checked={selectedProvider === 'google_routes'}
                  onChange={() => setSelectedProvider('google_routes')}
                  disabled={setupRequired || saving}
                />
                <div>
                  <div className="font-semibold text-slate-900">Google Routes</div>
                  <div className="text-xs text-slate-500">Use Google as the primary verified route source.</div>
                </div>
              </div>
            </label>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <p className="font-medium">Fallback behavior</p>
            <p className="mt-1">{data?.fallbackDescription || 'Automatic fallback to the other provider is enabled.'}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {data?.cacheInvalidationNote}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={setupRequired || saving || !hasPendingChange}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? 'Saving...' : 'Save setting'}
            </button>
            {!hasPendingChange && !saving && (
              <p className="text-sm text-slate-500">No pending routing configuration changes.</p>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}