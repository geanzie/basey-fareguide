'use client'

import { useEffect, useMemo, useState } from 'react'

import type {
  PublicRideTagLookupResultDto,
  PublicRideTagVehicleDto,
  VehicleLookupDto,
} from '@/lib/contracts'

import QrTokenScannerPanel from './QrTokenScannerPanel'

interface PublicRideTagScannerProps {
  selectedVehicle: VehicleLookupDto | null
  onUseVehicle: (vehicle: VehicleLookupDto) => void
  onClearVehicle: () => void
  autoStart?: boolean
  embedded?: boolean
}

function toVehicleLookupDto(vehicle: PublicRideTagVehicleDto): VehicleLookupDto {
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    permitPlateNumber: vehicle.permitPlateNumber,
    vehicleType: vehicle.vehicleType,
    make: vehicle.make,
    model: vehicle.model,
    color: vehicle.color,
    ownerName: null,
    driverName: vehicle.driverName,
    driverLicense: null,
  }
}

export default function PublicRideTagScanner({
  selectedVehicle,
  onUseVehicle,
  onClearVehicle,
  autoStart = false,
  embedded = false,
}: PublicRideTagScannerProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(autoStart)
  const [lookupResult, setLookupResult] = useState<PublicRideTagLookupResultDto | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const selectedVehicleLabel = useMemo(
    () => selectedVehicle?.permitPlateNumber || selectedVehicle?.plateNumber || null,
    [selectedVehicle],
  )

  useEffect(() => {
    if (autoStart && !selectedVehicleLabel && !lookupResult && !errorMessage) {
      setIsScannerOpen(true)
    }
  }, [autoStart, errorMessage, lookupResult, selectedVehicleLabel])

  const handleDetected = async (token: string) => {
    setIsLookingUp(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/public/ride-tag/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const payload = (await response.json()) as PublicRideTagLookupResultDto & { message?: string }

      if (!response.ok) {
        setErrorMessage(payload.message || 'Unable to check this QR token right now.')
        setIsScannerOpen(false)
        return
      }

      setLookupResult(payload)
      setIsScannerOpen(false)
    } catch {
      setErrorMessage('Unable to check this QR token right now.')
      setIsScannerOpen(false)
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleCameraNotice = (message: string) => {
    setErrorMessage(message)
    setIsScannerOpen(false)
  }

  const handleUseVehicle = () => {
    if (!lookupResult?.matchFound || !lookupResult.vehicle) {
      return
    }

    onUseVehicle(toVehicleLookupDto(lookupResult.vehicle))
    setErrorMessage(null)
    setLookupResult(null)
    setIsScannerOpen(false)
  }

  const resetLookup = () => {
    setLookupResult(null)
    setErrorMessage(null)
    setIsScannerOpen(true)
  }

  const handleClearTaggedVehicle = () => {
    onClearVehicle()
    setLookupResult(null)
    setErrorMessage(null)
    setIsScannerOpen(autoStart)
  }

  const containerClassName = embedded
    ? 'space-y-4'
    : 'space-y-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm'

  return (
    <div className={containerClassName}>
      {!selectedVehicleLabel && !lookupResult && !isScannerOpen ? (
        <p className="text-sm leading-6 text-slate-600">
          Recommended for faster and more accurate trip identification.
        </p>
      ) : null}

      {selectedVehicleLabel ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Ride tagged</p>
          <p className="mt-1">{selectedVehicleLabel} will be saved with this trip.</p>
          <button
            type="button"
            onClick={handleClearTaggedVehicle}
            className="mt-3 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-white/70"
          >
            Clear tagged vehicle
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errorMessage}
        </div>
      ) : null}

      {lookupResult ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scan result</p>
          <p className="mt-2 text-sm text-slate-700">{lookupResult.message}</p>

          {lookupResult.matchFound && lookupResult.permit && lookupResult.vehicle ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Permit plate</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{lookupResult.permit.permitPlateNumber}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Permit validity</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{lookupResult.permitStatus}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Driver or operator</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{lookupResult.permit.driverFullName}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vehicle</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {lookupResult.vehicle.permitPlateNumber || lookupResult.vehicle.plateNumber}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {lookupResult.vehicle.vehicleType.replace(/_/g, ' ')} · {lookupResult.vehicle.make} {lookupResult.vehicle.model}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {lookupResult.matchFound && lookupResult.vehicle ? (
              <button
                type="button"
                onClick={handleUseVehicle}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Use this vehicle
              </button>
            ) : null}
            <button
              type="button"
              onClick={resetLookup}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Scan again
            </button>
          </div>
        </div>
      ) : null}

      {isScannerOpen ? (
        <div className="space-y-3">
          <QrTokenScannerPanel active onDetected={handleDetected} onCameraNotice={handleCameraNotice} />
          <button
            type="button"
            onClick={() => setIsScannerOpen(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Stop scanner
          </button>
        </div>
      ) : lookupResult ? null : (
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null)
            setLookupResult(null)
            setIsScannerOpen(true)
          }}
          disabled={isLookingUp}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLookingUp ? 'Checking QR...' : 'Open QR scanner'}
        </button>
      )}
    </div>
  )
}