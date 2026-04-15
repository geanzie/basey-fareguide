'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { useAuth } from './AuthProvider'

interface DriverSummaryResponse {
  driver: {
    id: string
    firstName: string
    lastName: string
    username: string
    assignedVehicleAssignedAt: string | null
  }
  vehicle: {
    id: string
    plateNumber: string
    vehicleType: string
    make: string
    model: string
    color: string
    isActive: boolean
    registrationExpiry: string
    insuranceExpiry: string | null
  }
  permit: {
    id: string
    permitPlateNumber: string
    driverFullName: string
    status: string
    issuedDate: string
    expiryDate: string
    qrIssuedAt: string | null
    hasQrToken: boolean
  } | null
  summary: {
    fareCalculationCount: number
    totalIncidents: number
    openIncidents: number
    unpaidTickets: number
    outstandingPenalties: number
  }
  recentFareCalculations: Array<{
    id: string
    fromLocation: string
    toLocation: string
    calculatedFare: number
    createdAt: string
  }>
}

export default function DriverDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DriverSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadDriverSummary = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/driver/summary')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.message || payload.error || 'Failed to load driver summary')
        }

        if (active) {
          setData(payload)
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load driver summary')
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDriverSummary()

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <p className="text-sm text-gray-600">Loading driver summary...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-surface-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900">Driver Portal</h2>
        <p className="mt-3 text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="app-surface-card rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-gray-900">Driver Visibility Portal</h2>
        <p className="mt-2 text-sm text-gray-600">
          This role is now provisioned as a dedicated driver account. The portal is read-only and is scoped to the
          vehicle assignment managed by the LGU.
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-2 text-lg font-semibold text-gray-900">Driver</dd>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <dt className="text-sm font-medium text-gray-500">BPLO Username</dt>
            <dd className="mt-2 text-lg font-semibold text-gray-900">{user?.username ?? 'Not available'}</dd>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <dt className="text-sm font-medium text-gray-500">Assigned Vehicle</dt>
            <dd className="mt-2 text-lg font-semibold text-gray-900">
              {data?.vehicle.plateNumber ?? 'Not assigned'}
            </dd>
            <p className="mt-1 text-sm text-gray-500">
              {data ? `${data.vehicle.vehicleType} • ${data.vehicle.make} ${data.vehicle.model}` : 'No vehicle assignment'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <dt className="text-sm font-medium text-gray-500">Permit Status</dt>
            <dd className="mt-2 text-lg font-semibold text-gray-900">
              {data?.permit?.status ?? 'No permit linked'}
            </dd>
            <p className="mt-1 text-sm text-gray-500">
              {data?.permit ? `Permit ${data.permit.permitPlateNumber}` : 'Awaiting permit linkage'}
            </p>
          </div>
        </dl>

        {data ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Saved fare logs" value={String(data.summary.fareCalculationCount)} />
            <SummaryCard label="Total incidents" value={String(data.summary.totalIncidents)} />
            <SummaryCard label="Open incidents" value={String(data.summary.openIncidents)} />
            <SummaryCard label="Outstanding penalties" value={`PHP ${data.summary.outstandingPenalties.toFixed(2)}`} />
          </div>
        ) : null}

        {data?.recentFareCalculations.length ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent vehicle-linked fare history</h3>
            <ul className="mt-3 space-y-3 text-sm text-gray-600">
              {data.recentFareCalculations.map((calculation) => (
                <li key={calculation.id} className="flex flex-col gap-1 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {calculation.fromLocation} to {calculation.toLocation}
                    </div>
                    <div>{new Date(calculation.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="font-semibold text-gray-900">PHP {calculation.calculatedFare.toFixed(2)}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <aside className="app-surface-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900">Current Scope</h2>
        <ul className="mt-4 space-y-3 text-sm text-gray-600">
          <li>View assigned vehicle and permit details for the active LGU-managed assignment.</li>
          <li>View QR status, incidents, penalties, and compliance reminders for the assigned vehicle.</li>
          <li>Use the shared profile page for password and contact updates.</li>
          <li>Permit renewal, public rider tools, and enforcement actions remain outside this role.</li>
        </ul>

        {data ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            <div className="font-semibold text-gray-900">Compliance snapshot</div>
            <div className="mt-2">QR issued: {data.permit?.hasQrToken ? 'Yes' : 'No'}</div>
            <div>Unpaid tickets: {data.summary.unpaidTickets}</div>
            <div>Registration expiry: {new Date(data.vehicle.registrationExpiry).toLocaleDateString()}</div>
          </div>
        ) : null}

        <Link
          href="/profile"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Open My Profile
        </Link>
      </aside>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}