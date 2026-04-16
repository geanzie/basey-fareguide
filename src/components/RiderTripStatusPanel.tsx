'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import type { RiderActiveTripStatusResponseDto } from '@/lib/contracts'
import { SWR_KEYS } from '@/lib/swrKeys'

interface RiderTripStatusPanelProps {
  fareCalculationId: string
}

function formatCurrency(value: number) {
  return `PHP ${value.toFixed(2)}`
}

export default function RiderTripStatusPanel({ fareCalculationId }: RiderTripStatusPanelProps) {
  const [showToast, setShowToast] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const swrKey = `${SWR_KEYS.riderTripStatus}?fareCalculationId=${fareCalculationId}`

  const { data } = useSWR<RiderActiveTripStatusResponseDto>(swrKey, {
    refreshInterval: (latestData) => {
      const status = latestData?.trip?.status
      if (!status || status === 'PENDING') return 5000
      return 0
    },
  })

  useEffect(() => {
    const currentStatus = data?.trip?.status ?? null
    if (prevStatusRef.current === 'PENDING' && currentStatus === 'ACCEPTED') {
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
  const isAccepted = trip.status === 'ACCEPTED' || trip.status === 'BOARDED'

  return (
    <div className="relative mt-3 w-full">
      {/* Toast overlay on acceptance */}
      {showToast ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-10 left-0 right-0 z-10 flex justify-center"
        >
          <span className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md">
            Driver accepted your trip
          </span>
        </div>
      ) : null}

      {/* Status card */}
      <div
        className={`rounded-2xl border p-3 sm:p-4 ${
          isAccepted
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              isAccepted ? 'text-emerald-700' : 'text-slate-500'
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
            <span className="ml-2 text-xs font-normal text-emerald-700">
              {trip.discountType.replace(/_/g, ' ')} discount
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
