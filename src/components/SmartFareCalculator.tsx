'use client'

import { useState, useEffect } from 'react'
import { barangayService } from '../lib/barangayService'
import { BarangayInfo } from '../utils/barangayBoundaries'

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
  preferredMethod?: 'auto' | 'google-maps' | 'gps'
  onError?: (error: string) => void
  onRouteCalculated?: (result: RouteResult, fallbackUsed: boolean) => void
  hideResults?: boolean
}

const SmartFareCalculator = ({ 
  preferredMethod = 'auto', 
  onError,
  onRouteCalculated,
  hideResults = false
}: SmartFareCalculatorProps) => {
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [methodUsed, setMethodUsed] = useState<string>('')
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [barangayList, setBarangayList] = useState<BarangayInfo[]>([])
  const [filteredFromBarangays, setFilteredFromBarangays] = useState<BarangayInfo[]>([])
  const [filteredToBarangays, setFilteredToBarangays] = useState<BarangayInfo[]>([])
  const [showFromSuggestions, setShowFromSuggestions] = useState(false)
  const [showToSuggestions, setShowToSuggestions] = useState(false)

  // Initialize barangay data from the comprehensive GeoJSON dataset
  useEffect(() => {
    const initializeBarangays = async () => {
      try {
        await barangayService.initialize()
        const allBarangays = barangayService.getBarangays()
        setBarangayList(allBarangays)
        setFilteredFromBarangays(allBarangays)
        setFilteredToBarangays(allBarangays)
      } catch (error) {}
    }
    initializeBarangays()
  }, [])

  // Filter barangays based on search input
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

  // Legacy barangay list for backwards compatibility
  const barangays: string[] = [
    'Basey I Central School',
    'Basey National High School',
    'Basey Port/Wharf',
    'Rural Health Unit Basey'
  ]

  // Helper function to categorize locations for better organization
  const getLocationType = (location: string): 'urban' | 'rural' | 'landmark' => {
    if (location.includes('Poblacion')) return 'urban'
    if (location.includes('José Rizal Monument') || 
        location.includes('Sohoton') || 
        location.includes('Panhulugan') ||
        location.includes('Basey Church') ||
        location.includes('Municipal Hall') ||
        location.includes('Public Market') ||
        location.includes('School') ||
        location.includes('Port') ||
        location.includes('Health Unit')) {
      return 'landmark'
    }
    return 'rural'
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
      // Use the smart API that tries Google Maps and falls back to GPS
      // Since we're using Google Maps API, we send location names instead of coordinates
      const response = await fetch('/api/routes/smart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: fromLocation,
          destination: toLocation,
          preferredMethod: preferredMethod
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate route')
      }

      if (data.success && data.route) {
        setRouteResult(data.route)
        setMethodUsed(data.method || 'unknown')
        const wasFallbackUsed = data.fallbackUsed || false
        setFallbackUsed(wasFallbackUsed)
        
        // Call the onRouteCalculated callback if provided
        if (onRouteCalculated) {
          onRouteCalculated(data.route, wasFallbackUsed)
        }
      } else {
        throw new Error('Invalid response from route calculation')
      }
    } catch (error) {      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate route'
      setError(errorMessage)
      
      // Call the onError callback if provided
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        Smart Fare Calculator
      </h2>

      <div className="space-y-6">
        {/* From Location with Enhanced Search */}
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
          
          {showFromSuggestions && filteredFromBarangays.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
                📍 {filteredFromBarangays.length} barangays found
              </div>
              
              {/* Poblacion Barangays */}
              {filteredFromBarangays.filter(b => b.isPoblacion).length > 0 && (
                <>
                  <div className="p-2 text-xs font-medium text-blue-600 bg-blue-50 border-b">
                    🏛️ Urban Centers (Poblacion)
                  </div>
                  {filteredFromBarangays.filter(b => b.isPoblacion).map((barangay) => (
                    <button
                      key={barangay.code}
                      onClick={() => {
                        setFromLocation(barangay.name)
                        setShowFromSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-sm"
                    >
                      <div className="font-medium">{barangay.name}</div>
                      <div className="text-xs text-gray-500">Code: {barangay.code}</div>
                    </button>
                  ))}
                </>
              )}
              
              {/* Rural Barangays */}
              {filteredFromBarangays.filter(b => !b.isPoblacion).length > 0 && (
                <>
                  <div className="p-2 text-xs font-medium text-green-600 bg-green-50 border-b">
                    🌾 Rural Barangays
                  </div>
                  {filteredFromBarangays.filter(b => !b.isPoblacion).map((barangay) => (
                    <button
                      key={barangay.code}
                      onClick={() => {
                        setFromLocation(barangay.name)
                        setShowFromSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 focus:bg-green-50 focus:outline-none text-sm"
                    >
                      <div className="font-medium">{barangay.name}</div>
                      <div className="text-xs text-gray-500">Code: {barangay.code}</div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* To Location with Enhanced Search */}
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
          
          {showToSuggestions && filteredToBarangays.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
                📍 {filteredToBarangays.length} barangays found
              </div>
              
              {/* Poblacion Barangays */}
              {filteredToBarangays.filter(b => b.isPoblacion).length > 0 && (
                <>
                  <div className="p-2 text-xs font-medium text-blue-600 bg-blue-50 border-b">
                    🏛️ Urban Centers (Poblacion)
                  </div>
                  {filteredToBarangays.filter(b => b.isPoblacion).map((barangay) => (
                    <button
                      key={barangay.code}
                      onClick={() => {
                        setToLocation(barangay.name)
                        setShowToSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-sm"
                    >
                      <div className="font-medium">{barangay.name}</div>
                      <div className="text-xs text-gray-500">Code: {barangay.code}</div>
                    </button>
                  ))}
                </>
              )}
              
              {/* Rural Barangays */}
              {filteredToBarangays.filter(b => !b.isPoblacion).length > 0 && (
                <>
                  <div className="p-2 text-xs font-medium text-green-600 bg-green-50 border-b">
                    🌾 Rural Barangays
                  </div>
                  {filteredToBarangays.filter(b => !b.isPoblacion).map((barangay) => (
                    <button
                      key={barangay.code}
                      onClick={() => {
                        setToLocation(barangay.name)
                        setShowToSuggestions(false)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-green-50 focus:bg-green-50 focus:outline-none text-sm"
                    >
                      <div className="font-medium">{barangay.name}</div>
                      <div className="text-xs text-gray-500">Code: {barangay.code}</div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          disabled={isCalculating || !fromLocation || !toLocation}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
        >
          {isCalculating ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating...
            </div>
          ) : (
            '🧮 Calculate Fare'
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-3">⚠️</span>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {routeResult && !hideResults && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Route Calculation Result</h3>
              {fallbackUsed && (
                <div className="bg-amber-100 border border-amber-300 rounded-lg p-2 mb-3">
                  <p className="text-amber-700 text-sm">
                    ℹ️ Google Maps unavailable - using GPS calculation as fallback
                  </p>
                </div>
              )}
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
                  ₱{routeResult.fare.fare.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Fare</div>
              </div>
            </div>

            {/* Fare Breakdown */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-800 mb-3">Fare Breakdown</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Base fare (first 3km):</span>
                  <span>₱{routeResult.fare.breakdown.baseFare.toFixed(2)}</span>
                </div>
                {routeResult.fare.breakdown.additionalDistance > 0 && (
                  <div className="flex justify-between">
                    <span>Additional distance ({routeResult.fare.breakdown.additionalDistance.toFixed(1)}km @ ₱3/km):</span>
                    <span>₱{routeResult.fare.breakdown.additionalFare.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>₱{routeResult.fare.fare.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Barangay Boundary Information */}
            {routeResult.barangayInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  🗺️ Geographic Analysis
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
                
                {routeResult.barangayInfo.crossesBoundary && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center text-amber-700">
                      <span className="mr-2">⚠️</span>
                      <span className="font-medium">Cross-Barangay Trip</span>
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      This route crosses barangay boundaries, which may affect fare calculations.
                    </div>
                  </div>
                )}

                {routeResult.barangayInfo.recommendations.length > 0 && (
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
                )}
              </div>
            )}

            {/* Method Info */}
            <div className="text-center text-xs text-gray-500">
              Calculated using: {routeResult.source} • Accuracy: {routeResult.accuracy}
              <br />
              Enhanced with Basey Municipality Barangay Boundary Data (51 Barangays)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SmartFareCalculator