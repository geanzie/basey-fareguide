'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import type {
  DriverSessionActionDto,
  DriverSessionActiveResponseDto,
  DriverSessionRiderCardDto,
  DriverSessionSectionDto,
} from '@/lib/contracts'

import { useAuth } from './AuthProvider'
import PermitQrCard from './PermitQrCard'

type PermitQrData = {
  permitPlateNumber: string
  qrToken: string
  driverFullName: string
  permitStatus: string
  permitExpiryDate: string
}

type SessionOperationState = {
  targetId: string | null
  action: string | null
}

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not started'
  }

  return new Date(value).toLocaleString()
}

function isArchivedSection(section: DriverSessionSectionDto) {
  return section.key === 'archived'
}

function toProblemActions(rider: DriverSessionRiderCardDto) {
  return rider.availableActions.filter((action) => action.kind === 'negative')
}

export default function DriverDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DriverSessionActiveResponseDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operation, setOperation] = useState<SessionOperationState>({ targetId: null, action: null })
  const [expandedProblemRiderId, setExpandedProblemRiderId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [permitQr, setPermitQr] = useState<PermitQrData | null>(null)
  const [permitQrLoading, setPermitQrLoading] = useState(false)
  const [permitQrError, setPermitQrError] = useState<string | null>(null)
  const [showPermitQr, setShowPermitQr] = useState(false)

  const loadDriverSession = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/driver/session/active')
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load trip session')
      }

      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load trip session')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      try {
        const response = await fetch('/api/driver/session/active')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.message || payload.error || 'Failed to load trip session')
        }

        if (active) {
          setData(payload)
          setError(null)
          setLoading(false)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load trip session')
          setData(null)
          setLoading(false)
        }
      }
    }

    void hydrate()

    return () => {
      active = false
    }
  }, [])

  const runSessionRequest = async (targetId: string, action: string, request: () => Promise<Response>) => {
    try {
      setOperation({ targetId, action })
      setError(null)

      const response = await request()
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to update trip session')
      }

      if ('sections' in payload) {
        setData(payload)
      } else if (data) {
        await loadDriverSession()
      }

      setExpandedProblemRiderId(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update trip session')
    } finally {
      setOperation({ targetId: null, action: null })
    }
  }

  const handleViewPermitQr = async () => {
    if (permitQr) {
      setShowPermitQr(true)
      return
    }

    try {
      setPermitQrLoading(true)
      setPermitQrError(null)

      const response = await fetch('/api/driver/permit/qr')
      const payload = await response.json()

      if (!response.ok) {
        setPermitQrError(payload.error ?? 'Unable to load permit QR.')
        return
      }

      setPermitQr(payload as PermitQrData)
      setShowPermitQr(true)
    } catch {
      setPermitQrError('Unable to load permit QR.')
    } finally {
      setPermitQrLoading(false)
    }
  }

  const handleStartTrip = async () => {
    await runSessionRequest('session-start', 'start', () =>
      fetch('/api/driver/session/start', {
        method: 'POST',
      }),
    )
  }

  const handleCloseTrip = async () => {
    if (!data?.session.id) {
      return
    }

    await runSessionRequest(data.session.id, 'close', () =>
      fetch(`/api/driver/session/${data.session.id}/close`, {
        method: 'POST',
      }),
    )
  }

  const handleRiderAction = async (riderId: string, action: DriverSessionActionDto) => {
    if (!data?.session.id) {
      return
    }

    await runSessionRequest(riderId, action, () =>
      fetch(`/api/driver/session/${data.session.id}/riders/${riderId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      }),
    )
  }

  if (loading) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <p className="text-sm text-gray-600">Loading trip session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900">Trip Session</h2>
        <p className="mt-3 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => void loadDriverSession()}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  const archivedSection = data?.sections.find(isArchivedSection) ?? null
  const visibleSections = data?.sections.filter((section) => !isArchivedSection(section)) ?? []

  return (
    <>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_320px]">
      <section className="space-y-6">
        <div className="app-surface-card rounded-2xl p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Assigned vehicle</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">{data?.vehicle.plateNumber ?? 'Not assigned'}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {data ? `${data.vehicle.vehicleType.replace(/_/g, ' ')} • ${data.vehicle.make} ${data.vehicle.model}` : 'No vehicle assignment'}
              </p>
              <p className="mt-2 text-sm text-slate-500">BPLO Username: {user?.username ?? data?.driver.username ?? 'Not available'}</p>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                {data?.session.statusLabel ?? 'No Active Trip'}
              </span>
              {data?.session.canStartSession ? (
                <button
                  type="button"
                  onClick={() => void handleStartTrip()}
                  disabled={operation.targetId === 'session-start'}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {operation.targetId === 'session-start' ? 'Starting...' : 'Start Trip'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleCloseTrip()}
                  disabled={!data?.session.canCloseSession || operation.targetId === data?.session.id}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {operation.targetId === data?.session.id ? 'Closing...' : 'Close Trip'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Session status" value={data?.session.statusLabel ?? 'No Active Trip'} />
            <SummaryCard label="Active riders" value={String(data?.session.activeRiderCount ?? 0)} />
            <SummaryCard label="Started" value={formatDateTime(data?.session.openedAt ?? null)} />
          </div>
        </div>

        {!data?.session.id ? (
          <div className="app-surface-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-slate-900">Ready to load riders</h3>
            <p className="mt-2 text-sm text-slate-600">
              Start one trip for this vehicle, then riders who save tagged trips will appear here as pending.
            </p>
          </div>
        ) : null}

        {visibleSections.map((section) => (
          <section key={section.key} className="app-surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{section.label}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {section.riders.length}
              </span>
            </div>

            {section.riders.length > 0 ? (
              <div className="mt-4 space-y-3">
                {section.riders.map((rider) => {
                  const positiveActions = rider.availableActions.filter((action) => action.kind === 'positive')
                  const negativeActions = toProblemActions(rider)
                  const isBusy = operation.targetId === rider.id
                  const problemExpanded = expandedProblemRiderId === rider.id

                  return (
                    <article key={rider.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                              {rider.statusLabel}
                            </span>
                            <span className="text-xs text-slate-500">Joined {formatDateTime(rider.joinedAt)}</span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-500">Origin</div>
                            <div className="text-base font-semibold text-slate-900">{rider.origin}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-500">Destination</div>
                            <div className="text-base font-semibold text-slate-900">{rider.destination}</div>
                          </div>
                        </div>

                        <div className="sm:text-right">
                          <div className="text-sm font-medium text-slate-500">Fare</div>
                          <div className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(rider.fareSnapshot)}</div>
                        </div>
                      </div>

                      {rider.availableActions.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {positiveActions.map((action) => (
                              <button
                                key={action.action}
                                type="button"
                                onClick={() => void handleRiderAction(rider.id, action.action)}
                                disabled={isBusy}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isBusy && operation.action === action.action ? 'Saving...' : action.label}
                              </button>
                            ))}

                            {negativeActions.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedProblemRiderId(problemExpanded ? null : rider.id)}
                                disabled={isBusy}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Problem
                              </button>
                            ) : null}
                          </div>

                          {problemExpanded ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Choose a reason</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {negativeActions.map((action) => (
                                  <button
                                    key={action.action}
                                    type="button"
                                    onClick={() => void handleRiderAction(rider.id, action.action)}
                                    disabled={isBusy}
                                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isBusy && operation.action === action.action ? 'Saving...' : action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No riders in this section.</p>
            )}
          </section>
        ))}

        {archivedSection && archivedSection.riders.length > 0 ? (
          <section className="app-surface-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Archived</h3>
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {showArchived ? 'Hide' : 'Show'}
              </button>
            </div>

            {showArchived ? (
              <div className="mt-4 space-y-3">
                {archivedSection.riders.map((rider) => (
                  <article key={rider.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                            {rider.statusLabel}
                          </span>
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-900">
                          {rider.origin} to {rider.destination}
                        </div>
                      </div>
                      <div className="text-base font-semibold text-slate-900">{formatCurrency(rider.fareSnapshot)}</div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </section>

      <aside className="app-surface-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-900">Session Notes</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li>Riders keep their own saved trip records.</li>
          <li>Use Accept, Boarded, and Dropped Off for normal handling.</li>
          <li>Use the problem button only when you need a fixed reason.</li>
          <li>Route and fare details stay locked to the rider trip record.</li>
        </ul>

        {data ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Trip summary</div>
            <div className="mt-2">Pending: {data.session.pendingCount}</div>
            <div>Boarded: {data.session.boardedCount}</div>
            <div>Completed: {data.session.completedCount}</div>
          </div>
        ) : null}

        <Link
          href="/profile"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open My Profile
        </Link>
      </aside>
    </div>

      {/* Floating permit QR button */}
      <button
        type="button"
        onClick={() => void handleViewPermitQr()}
        disabled={permitQrLoading}
        aria-label="View my permit QR"
        style={{ bottom: 'calc(var(--mobile-bottom-nav-height, 0px) + 1rem)' } as React.CSSProperties}
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:right-6"
      >
        {permitQrLoading ? (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3v3M21 14v2" />
          </svg>
        )}
      </button>

      {/* Permit QR modal */}
      {showPermitQr && permitQr ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-end sm:justify-end sm:p-6"
          style={{ paddingBottom: 'calc(var(--mobile-bottom-nav-height, 0px) + 1rem)' } as React.CSSProperties}
          onClick={() => setShowPermitQr(false)}
        >
          <div
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">My Permit QR</h3>
                <p className="text-xs text-slate-500">Show this at the compliance terminal.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPermitQr(false)}
                aria-label="Close permit QR"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <PermitQrCard
              permitPlateNumber={permitQr.permitPlateNumber}
              qrToken={permitQr.qrToken}
              driverFullName={permitQr.driverFullName}
            />
          </div>
        </div>
      ) : null}

      {/* Permit QR error toast */}
      {permitQrError && !showPermitQr ? (
        <div
          style={{ bottom: 'calc(var(--mobile-bottom-nav-height, 0px) + 5rem)' } as React.CSSProperties}
          className="fixed left-4 right-4 z-50 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg sm:left-auto sm:right-6 sm:max-w-xs"
        >
          {permitQrError}
        </div>
      ) : null}
    </>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-slate-900">{value}</div>
    </div>
  )
}