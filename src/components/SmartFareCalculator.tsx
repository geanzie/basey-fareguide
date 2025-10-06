'use client'

import { useState, useEffect } from 'react'

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

  // Official Barangays of Basey Municipality (51 Barangays + Landmarks)
  const barangays: string[] = [
    // Official Barangays of Basey Municipality (51 Barangays)
    'Amandayehan',
    'Anglit', 
    'Bacubac',
    'Baloog',
    'Basiao',
    'Buenavista',
    'Burgos',
    'Cambayan',
    'Can-abay',
    'Cancaiyas',
    'Canmanila',
    'Catadman',
    'Cogon',
    'Dolongan',
    'Guintigui-an',
    'Guirang',
    'Balante',
    'Iba',
    'Inuntan',
    'Loog',
    'Mabini',
    'Magallanes',
    'Manlilinab',
    'Del Pilar',
    'May-it',
    'Mongabong',
    'New San Agustin',
    'Nouvelas Occidental',
    'Old San Agustin',
    'Panugmonon',
    'Pelit',
    
    // Poblacion Barangays (7 Urban Centers)
    'Baybay (Poblacion)',
    'Buscada (Poblacion)',
    'Lawa-an (Poblacion)',
    'Loyo (Poblacion)',
    'Mercado (Poblacion)',
    'Palaypay (Poblacion)',
    'Sulod (Poblacion)',
    
    // Remaining Barangays
    'Roxas',
    'Salvacion',
    'San Antonio',
    'San Fernando',
    'Sawa',
    'Serum',
    'Sugca',
    'Sugponon',
    'Tinaogan',
    'Tingib',
    'Villa Aurora',
    'Binongtu-an',
    'Bulao',
    
    // Key Landmarks and Places of Interest in Basey Municipality
    'José Rizal Monument (Basey Center - KM 0)',
    'Sohoton Natural Bridge National Park',
    'Sohoton Caves',
    'Panhulugan Cliff',
    'Basey Church (St. Michael the Archangel)',
    'Basey Municipal Hall',
    'Basey Public Market',
    'Basey Central School',
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
    } catch (error) {
      console.error('Error calculating route:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to calculate route'
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
        {/* From Location */}
        <div>
          <label htmlFor="from" className="block text-sm font-semibold text-gray-700 mb-2">
            From (Origin)
          </label>
          <select
            id="from"
            value={fromLocation}
            onChange={(e) => setFromLocation(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
          >
            <option value="">Select starting point...</option>
            <optgroup label="Urban Centers (Poblacion)">
              {barangays.filter(b => getLocationType(b) === 'urban').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
            <optgroup label="Rural Barangays">
              {barangays.filter(b => getLocationType(b) === 'rural').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
            <optgroup label="Landmarks">
              {barangays.filter(b => getLocationType(b) === 'landmark').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* To Location */}
        <div>
          <label htmlFor="to" className="block text-sm font-semibold text-gray-700 mb-2">
            To (Destination)
          </label>
          <select
            id="to"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
          >
            <option value="">Select destination...</option>
            <optgroup label="Urban Centers (Poblacion)">
              {barangays.filter(b => getLocationType(b) === 'urban').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
            <optgroup label="Rural Barangays">
              {barangays.filter(b => getLocationType(b) === 'rural').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
            <optgroup label="Landmarks">
              {barangays.filter(b => getLocationType(b) === 'landmark').map((barangay) => (
                <option key={barangay} value={barangay}>
                  {barangay}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          disabled={isCalculating || !fromLocation || !toLocation}
          className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-emerald-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
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
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-lg p-6">
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
                <div className="text-2xl font-bold text-emerald-600">
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
                <div className="text-3xl font-bold text-green-600">
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

            {/* Method Info */}
            <div className="text-center text-xs text-gray-500">
              Calculated using: {routeResult.source} • Accuracy: {routeResult.accuracy}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SmartFareCalculator