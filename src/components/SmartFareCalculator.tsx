'use client'
// TODO: consolidate into RoutePlannerCalculator

import { useEffect, useState } from 'react'

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

import { barangayService } from '../lib/barangayService'
import type { BarangayInfo } from '../utils/barangayBoundaries'

interface RouteResult {
  distance: {
    meters: number
    kilometers: number
    text: string
  }
  duration: {
    seconds: number
    text: string
  }
  fare: {
    distance: number
    fare: number
    farePolicy: FarePolicySnapshotDto
    breakdown: {
      baseFare: number
      additionalDistance: number
      additionalFare: number
    }
  }
  source: string
  accuracy: string
  barangayInfo?: {
    originBarangay: string
    destinationBarangay: string
    crossesBoundary: boolean
    recommendations: string[]
  }
}

interface SmartFareCalculatorProps {
  onError?: (error: string) => void
  onRouteCalculated?: (result: RouteResult, fallbackUsed: boolean) => void
  hideResults?: boolean
}

const SmartFareCalculator = ({
  onError,
  onRouteCalculated,
  hideResults = false,
}: SmartFareCalculatorProps) => {
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [barangayList, setBarangayList] = useState<BarangayInfo[]>([])
  const [filteredFromBarangays, setFilteredFromBarangays] = useState<BarangayInfo[]>([])
  const [filteredToBarangays, setFilteredToBarangays] = useState<BarangayInfo[]>([])
  const [showFromSuggestions, setShowFromSuggestions] = useState(false)
  const [showToSuggestions, setShowToSuggestions] = useState(false)

  useEffect(() => {
    const initializeBarangays = async () => {
      try {
        await barangayService.initialize()
        const allBarangays = barangayService.getBarangays()
        setBarangayList(allBarangays)
        setFilteredFromBarangays(allBarangays)
        setFilteredToBarangays(allBarangays)
      } catch {}
    }

    initializeBarangays()
  }, [])

  const handleFromLocationChange = (value: string) => {
    setFromLocation(value)
    if (value.trim()) {
      const filtered = barangayService.getBarangays({ searchTerm: value })
      setFilteredFromBarangays(filtered)
      setShowFromSuggestions(true)
    } else {
      setFilteredFromBarangays(barangayList)
      setShowFromSuggestions(false)
    }
  }

  const handleToLocationChange = (value: string) => {
    setToLocation(value)
    if (value.trim()) {
      const filtered = barangayService.getBarangays({ searchTerm: value })
      setFilteredToBarangays(filtered)
      setShowToSuggestions(true)
    } else {
      setFilteredToBarangays(barangayList)
      setShowToSuggestions(false)
    }
  }

  const handleCalculate = async () => {
    if (!fromLocation || !toLocation) {
      setError('Please select both origin and destination')
      return
    }

    if (fromLocation === toLocation) {
      setError('Origin and destination cannot be the same')
      return
    }

    setIsCalculating(true)
    setError(null)
    setRouteResult(null)

    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: { type: 'preset', name: fromLocation },
          destination: { type: 'preset', name: toLocation },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate route')
      }

      const adaptedResult: RouteResult = {
        distance: {
          meters: data.distanceKm * 1000,
          kilometers: data.distanceKm,
          text: `${data.distanceKm.toFixed(2)} km`,
        },
        duration: {
          seconds: data.durationMin != null ? Math.round(data.durationMin * 60) : 0,
          text: data.durationMin != null ? `${Math.round(data.durationMin)} min` : 'N/A',
        },
        fare: {
          distance: data.distanceKm,
          fare: data.fare,
          farePolicy: resolveFarePolicySnapshot(data.farePolicy),
          breakdown: {
            baseFare: data.fareBreakdown.baseFare,
            additionalDistance: data.fareBreakdown.additionalKm,
            additionalFare: data.fareBreakdown.additionalFare,
          },
        },
        source: data.method === 'ors' ? 'OpenRouteService' : 'GPS Estimate',
        accuracy: data.method === 'ors' ? 'Road-based routing' : `GPS estimate${data.fallbackReason ? ' (ORS unavailable)' : ''}`,
        barangayInfo: undefined,
      }
      setRouteResult(adaptedResult)

      if (onRouteCalculated) {
        onRouteCalculated(adaptedResult, data.method === 'gps')
      }
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : 'Failed to calculate route'
      setError(errorMessage)

      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setIsCalculating(false)
    }
  }

  const renderSuggestionSection = (
    title: string,
    toneClasses: string,
    icon: typeof DASHBOARD_ICONS.building | typeof DASHBOARD_ICONS.rural,
    items: BarangayInfo[],
    onSelect: (barangay: BarangayInfo) => void,
  ) => {
    if (items.length === 0) {
      return null
    }

    return (
      <>
        <div className={`p-2 text-xs font-medium border-b flex items-center gap-2 ${toneClasses}`}>
          <DashboardIconSlot icon={icon} size={14} />
          <span>{title}</span>
        </div>
        {items.map((barangay) => (
          <button
            key={barangay.code}
            onClick={() => onSelect(barangay)}
            className="w-full text-left px-4 py-2 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm"
          >
            <div className="font-medium">{barangay.name}</div>
            <div className="text-xs text-gray-500">Code: {barangay.code}</div>
          </button>
        ))}
      </>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <FareRateBanner className="mb-6" />

      <div className="mb-6 text-center">
        <div className={`${getDashboardIconChipClasses('blue')} mx-auto mb-4 h-16 w-16 rounded-2xl`}>
          <DashboardIconSlot icon={DASHBOARD_ICONS.calculator} size={DASHBOARD_ICON_POLICY.sizes.hero} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Smart Fare Calculator
        </h2>
        <p className="text-sm text-gray-600">
          Search barangays faster and calculate routes with Basey boundary-aware suggestions.
        </p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <label htmlFor="from" className="block text-sm font-semibold text-gray-700 mb-2">
            From (Origin) - Enhanced with Barangay Boundaries
          </label>
          <input
            id="from"
            type="text"
            value={fromLocation}
            onChange={(e) => handleFromLocationChange(e.target.value)}
            onFocus={() => setShowFromSuggestions(true)}
            onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
            placeholder="Type to search barangays..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
          />

          {showFromSuggestions && filteredFromBarangays.length > 0 ? (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b flex items-center gap-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={14} />
                <span>{filteredFromBarangays.length} barangays found</span>
              </div>
              {renderSuggestionSection(
                'Urban Centers (Poblacion)',
                'text-blue-600 bg-blue-50',
                DASHBOARD_ICONS.building,
                filteredFromBarangays.filter((b) => b.isPoblacion),
                (barangay) => {
                  setFromLocation(barangay.name)
                  setShowFromSuggestions(false)
                },
              )}
              {renderSuggestionSection(
                'Rural Barangays',
                'text-green-600 bg-green-50',
                DASHBOARD_ICONS.rural,
                filteredFromBarangays.filter((b) => !b.isPoblacion),
                (barangay) => {
                  setFromLocation(barangay.name)
                  setShowFromSuggestions(false)
                },
              )}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <label htmlFor="to" className="block text-sm font-semibold text-gray-700 mb-2">
            To (Destination) - Enhanced with Barangay Boundaries
          </label>
          <input
            id="to"
            type="text"
            value={toLocation}
            onChange={(e) => handleToLocationChange(e.target.value)}
            onFocus={() => setShowToSuggestions(true)}
            onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
            placeholder="Type to search barangays..."
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
          />

          {showToSuggestions && filteredToBarangays.length > 0 ? (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b flex items-center gap-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={14} />
                <span>{filteredToBarangays.length} barangays found</span>
              </div>
              {renderSuggestionSection(
                'Urban Centers (Poblacion)',
                'text-blue-600 bg-blue-50',
                DASHBOARD_ICONS.building,
                filteredToBarangays.filter((b) => b.isPoblacion),
                (barangay) => {
                  setToLocation(barangay.name)
                  setShowToSuggestions(false)
                },
              )}
              {renderSuggestionSection(
                'Rural Barangays',
                'text-green-600 bg-green-50',
                DASHBOARD_ICONS.rural,
                filteredToBarangays.filter((b) => !b.isPoblacion),
                (barangay) => {
                  setToLocation(barangay.name)
                  setShowToSuggestions(false)
                },
              )}
            </div>
          ) : null}
        </div>

        <button
          onClick={handleCalculate}
          disabled={isCalculating || !fromLocation || !toLocation}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] inline-flex items-center justify-center"
        >
          {isCalculating ? (
            <LoadingSpinner size={20} className="mr-3 text-white" label="Calculating..." />
          ) : (
            <>
              <DashboardIconSlot icon={DASHBOARD_ICONS.calculator} size={DASHBOARD_ICON_POLICY.sizes.button} className="mr-2" />
              Calculate Fare
            </>
          )}
        </button>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.alert} className="text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : null}

        {routeResult && !hideResults ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Route Calculation Result</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {routeResult.distance.text}
                </div>
                <div className="text-sm text-gray-600">Distance</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {routeResult.duration.text}
                </div>
                <div className="text-sm text-gray-600">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700">
                  PHP {routeResult.fare.fare.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Fare</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <DashboardIconSlot icon={DASHBOARD_ICONS.fare} size={DASHBOARD_ICON_POLICY.sizes.button} className="text-blue-600" />
                <span>Fare Breakdown</span>
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base fare (first {routeResult.fare.farePolicy.baseDistanceKm} km):</span>
                  <span>PHP {routeResult.fare.breakdown.baseFare.toFixed(2)}</span>
                </div>
                {routeResult.fare.breakdown.additionalDistance > 0 ? (
                  <div className="flex justify-between">
                    <span>
                      Additional distance ({routeResult.fare.breakdown.additionalDistance.toFixed(1)}km @ PHP {routeResult.fare.farePolicy.perKmRate.toFixed(2)}/km):
                    </span>
                    <span>PHP {routeResult.fare.breakdown.additionalFare.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>PHP {routeResult.fare.fare.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {routeResult.barangayInfo ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <DashboardIconSlot icon={DASHBOARD_ICONS.map} size={DASHBOARD_ICON_POLICY.sizes.section} />
                  <span>Geographic Analysis</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-700">Origin Barangay:</div>
                    <div className="text-blue-700">{routeResult.barangayInfo.originBarangay}</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Destination Barangay:</div>
                    <div className="text-blue-700">{routeResult.barangayInfo.destinationBarangay}</div>
                  </div>
                </div>

                {routeResult.barangayInfo.crossesBoundary ? (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700">
                      <DashboardIconSlot icon={DASHBOARD_ICONS.reports} size={DASHBOARD_ICON_POLICY.sizes.button} />
                      <span className="font-medium">Cross-Barangay Trip</span>
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      This route crosses barangay boundaries, which may affect fare calculations.
                    </div>
                  </div>
                ) : null}

                {routeResult.barangayInfo.recommendations.length > 0 ? (
                  <div className="mt-3">
                    <div className="font-medium text-gray-700 mb-2">Recommendations:</div>
                    <div className="space-y-1">
                      {routeResult.barangayInfo.recommendations.map((rec, index) => (
                        <div key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="mr-2 text-xs">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="text-center text-xs text-gray-500">
              Calculated using: {routeResult.source} • Accuracy: {routeResult.accuracy}
              <br />
              Enhanced with Basey Municipality Barangay Boundary Data (51 Barangays)
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default SmartFareCalculator
