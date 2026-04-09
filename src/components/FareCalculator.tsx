'use client'
// TODO: consolidate into RoutePlannerCalculator

import { useState, useEffect, useMemo } from 'react'

import FareRateBanner from '@/components/FareRateBanner'
import LoadingSpinner from '@/components/LoadingSpinner'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
import type { FarePolicySnapshotDto } from '@/lib/contracts'
import { resolveFarePolicySnapshot } from '@/lib/fare/policy'

import { locationService, type Location } from '../lib/locationService'

interface RouteResult {
  distanceKm: number
  fare: number
  farePolicy: FarePolicySnapshotDto
  fareBreakdown: {
    baseFare: number
    additionalKm: number
    additionalFare: number
    discount: number
    total: number
  }
  method: 'ors' | 'gps'
}

const FareCalculator = () => {
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string>('')
  const [lastCalculationTime, setLastCalculationTime] = useState<number>(0)
  const [allLocations, setAllLocations] = useState<{
    barangays: Location[]
    landmarks: Location[]
    sitios: Location[]
  }>({ barangays: [], landmarks: [], sitios: [] })

  useEffect(() => {
    locationService.initialize().then(() => {
      setAllLocations(locationService.getGroupedLocations())
    }).catch(() => {})
  }, [])

  const locationOptions = useMemo(() => [
    ...allLocations.barangays,
    ...allLocations.landmarks,
    ...allLocations.sitios,
  ].sort((a, b) => a.name.localeCompare(b.name)), [allLocations])

  const handleCalculate = async () => {
    setError('')
    const now = Date.now()
    if (now - lastCalculationTime < 2000) {
      setError('Please wait a moment before calculating again')
      return
    }
    if (!fromLocation || !toLocation) {
      setError('Please select both pickup and destination locations')
      return
    }
    if (fromLocation === toLocation) {
      setError('Pickup and destination cannot be the same')
      return
    }
    setIsCalculating(true)
    setLastCalculationTime(now)
    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { type: 'preset', name: fromLocation },
          destination: { type: 'preset', name: toLocation },
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate route')
      }
      setRouteResult({
        ...data,
        farePolicy: resolveFarePolicySnapshot(data.farePolicy),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to calculate route. Please try again.')
    } finally {
      setIsCalculating(false)
    }
  }

  const handleReset = () => {
    setFromLocation('')
    setToLocation('')
    setRouteResult(null)
    setError('')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <FareRateBanner className="mb-6" />

      <div className="space-y-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-300">
          <div className="text-center mb-8">
            <div className={`${getDashboardIconChipClasses('emerald')} mx-auto mb-4 h-16 w-16 rounded-2xl`}>
              <DashboardIconSlot icon={DASHBOARD_ICONS.routes} size={DASHBOARD_ICON_POLICY.sizes.hero} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Enhanced Route Calculator
            </h3>
            <p className="text-gray-600 text-lg">
              Select pickup and destination locations for accurate fare calculation
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="from" className="block text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-flex items-center">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">1</span>
                  Pickup Location
                </span>
              </label>
              <select
                id="from"
                name="fromLocation"
                autoComplete="off"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white"
              >
                <option value="">Choose pickup location...</option>
                {locationOptions.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name} • {loc.category.charAt(0).toUpperCase() + loc.category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="to" className="block text-sm font-semibold text-gray-700 mb-3">
                <span className="inline-flex items-center">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">2</span>
                  Destination
                </span>
              </label>
              <select
                id="to"
                name="toLocation"
                autoComplete="off"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 bg-white"
              >
                <option value="">Choose destination...</option>
                {locationOptions.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name} • {loc.category.charAt(0).toUpperCase() + loc.category.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-600" />
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={handleCalculate}
                disabled={isCalculating || !fromLocation || !toLocation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 flex items-center justify-center"
              >
                {isCalculating ? (
                  <LoadingSpinner size={20} className="mr-3 text-white" label="Calculating Route..." />
                ) : (
                  <>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.calculator} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
                    Calculate Fare
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-200 focus:ring-offset-2 sm:w-auto inline-flex items-center justify-center"
              >
                <DashboardIconSlot icon={DASHBOARD_ICONS.reset} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {routeResult ? (
          <div className="animate-fade-in">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 text-white rounded-2xl mb-4">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={DASHBOARD_ICON_POLICY.sizes.hero} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-800">Fare Calculation Results</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                  <div className="text-3xl font-bold text-emerald-600 mb-2">
                    {routeResult.distanceKm.toFixed(2)} km
                  </div>
                  <div className="text-sm text-gray-600">Total Distance</div>
                  <div className="text-xs text-gray-500 mt-1">{routeResult.method === 'ors' ? 'OpenRouteService' : 'GPS Estimate'}</div>
                </div>
                <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                  <div className="text-3xl font-bold text-emerald-600 mb-2">
                    PHP {routeResult.fare.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Total Fare</div>
                  <div className="text-xs text-gray-500 mt-1">Municipal Ordinance 105</div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className={`${getDashboardIconChipClasses('emerald')} mr-3 h-8 w-8 rounded-lg`}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={16} />
                  </span>
                  Fare Breakdown
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Base fare (first {routeResult.farePolicy.baseDistanceKm} km):</span>
                    <span className="font-semibold text-gray-900">PHP {routeResult.fareBreakdown.baseFare.toFixed(2)}</span>
                  </div>
                  {routeResult.distanceKm > routeResult.farePolicy.baseDistanceKm ? (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Additional distance:</span>
                      <span className="font-semibold text-gray-900">
                        {(routeResult.distanceKm - routeResult.farePolicy.baseDistanceKm).toFixed(2)} km x PHP {routeResult.farePolicy.perKmRate.toFixed(2)} = PHP {routeResult.fareBreakdown.additionalFare.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  <div className="border-t-2 border-emerald-300 pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-700 text-lg">Total Fare:</span>
                      <span className="text-2xl font-bold text-emerald-600">PHP {routeResult.fare.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 text-center">
                      Based on Municipal Ordinance 105 Series of 2023
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default FareCalculator
