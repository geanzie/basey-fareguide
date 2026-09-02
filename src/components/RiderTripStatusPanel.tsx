'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import type { RiderActiveTripStatusResponseDto, RiderTripActionDto } from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'

interface RiderTripStatusPanelProps {
  tripRequestId: string
}

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

export default function RiderTripStatusPanel({ tripRequestId }: RiderTripStatusPanelProps) {
  const [showToast, setShowToast] = useState(false)
  const [pendingAction, setPendingAction] = useState<RiderTripActionDto | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const prevStatusRef = useRef<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const swrKey = `${SWR_KEYS.riderTripStatus}?tripRequestId=${tripRequestId}`

  const { data, mutate } = useSWR<RiderActiveTripStatusResponseDto>(swrKey, {
    refreshInterval: (latestData) => {
      const status = latestData?.trip?.status
      if (!status || status === 'PENDING' || status === 'ACCEPTED' || status === 'BOARDED') return 5000
      return 0
    },
  })

  useEffect(() => {
    const currentStatus = data?.trip?.status ?? null
    if (prevStatusRef.current === 'PENDING' && (currentStatus === 'ACCEPTED' || currentStatus === 'BOARDED')) {
      setShowToast(true)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setShowToast(false), 3000)
    }
    prevStatusRef.current = currentStatus
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [data?.trip?.status])

  if (!data?.hasActiveTrip || !data.trip) return null

  const { trip } = data
  const isCompleted = trip.status === 'COMPLETED'
  const isAccepted = trip.status === 'ACCEPTED' || trip.status === 'BOARDED'

  // Only a rider-initiated trip carries actions: on the driver-run flow the
  // driver owns these transitions, and the server refuses them here.
  const riderActions = trip.availableRiderActions ?? []

  const runRiderAction = async (action: RiderTripActionDto) => {
    setPendingAction(action)
    setActionError(null)

    try {
      const response = await fetch(`/api/public/trips/${trip.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = (await response.json().catch(() => ({}))) as { message?: string }

      if (!response.ok) {
        setActionError(payload.message || 'Unable to update this trip right now.')
        return
      }

      await mutate()
    } catch {
      setActionError('Unable to update this trip right now.')
    } finally {
      setPendingAction(null)
    }
  }

  if (isCompleted) {
    return (
      <div className="mt-3 w-full rounded-2xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            Completed
          </span>
          {trip.vehiclePlateNumber ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {trip.vehiclePlateNumber}
            </span>
          ) : null}
        </div>
        <div className="mt-2 text-sm font-medium text-slate-800">
          {trip.origin} → {trip.destination}
        </div>
        <div className="mt-1 text-base font-semibold text-slate-900">
          {formatCurrency(trip.fare)}
          {trip.discountType ? (
            <span className="ml-2 text-xs font-normal text-primary-dark">
              {trip.discountType.replace(/_/g, ' ')} discount
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-blue-600">Your trip has been completed. Thank you!</p>
      </div>
    )
  }

  return (
    <div className="relative mt-3 w-full">
      {/* Toast overlay on acceptance */}
      {showToast ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-10 left-0 right-0 z-10 flex justify-center"
        >
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-md">
            Driver accepted your trip
          </span>
        </div>
      ) : null}

      {/* Status card */}
      <div
        className={`rounded-2xl border p-3 sm:p-4 ${
          isAccepted
            ? 'border-primary/20 bg-surface-tint'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              isAccepted ? 'text-primary-dark' : 'text-slate-500'
            }`}
          >
            {trip.statusLabel}
          </span>
          {trip.vehiclePlateNumber ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              {trip.vehiclePlateNumber}
            </span>
          ) : null}
        </div>

        <div className="mt-2 text-sm font-medium text-slate-800">
          {trip.origin} → {trip.destination}
        </div>

        <div className="mt-1 text-base font-semibold text-slate-900">
          {formatCurrency(trip.fare)}
          {trip.discountType ? (
            <span className="ml-2 text-xs font-normal text-primary-dark">
              {trip.discountType.replace(/_/g, ' ')} discount
            </span>
          ) : null}
        </div>

        {riderActions.length ? (
          <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
            <p className="text-xs text-slate-600">
              Tap when you get off so the trip is closed on your record.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {riderActions.map((riderAction) => (
                <button
                  key={riderAction.action}
                  type="button"
                  onClick={() => void runRiderAction(riderAction.action)}
                  disabled={pendingAction !== null}
                  className={
                    riderAction.kind === 'positive'
                      ? 'rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-primary/40'
                      : 'rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'
                  }
                >
                  {pendingAction === riderAction.action ? 'Saving...' : riderAction.label}
                </button>
              ))}
            </div>
            {actionError ? (
              <p className="mt-2 text-xs text-red-600">{actionError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
