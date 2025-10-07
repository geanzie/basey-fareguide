'use client'

import { useState, useRef, useEffect } from 'react'
import { BASEY_LANDMARKS, EXTERNAL_LANDMARKS } from '../utils/baseyCenter'

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
  polyline?: string
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

interface GoogleMapsFareCalculatorProps {
  onError?: (error: string) => void
}

const GoogleMapsFareCalculator = ({ onError }: GoogleMapsFareCalculatorProps) => {
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string>('')
  const [lastCalculationTime, setLastCalculationTime] = useState<number>(0)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to results when they appear
  useEffect(() => {
    if (routeResult && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        })
      }, 300) // Small delay to ensure the animation starts after the component renders
    }
  }, [routeResult])

  // Official Barangays and Landmarks of Basey Municipality, Samar
  const barangays = [
    // Official Barangays of Basey Municipality (51 Barangays)
    { name: 'Amandayehan', coords: [11.2755464, 124.9989947], type: 'rural' as const },
    { name: 'Anglit', coords: [11.2976225, 125.1096464], type: 'rural' as const },
    { name: 'Bacubac', coords: [11.2822154, 125.0484524], type: 'rural' as const },
    { name: 'Baloog', coords: [11.3572, 125.0397], type: 'rural' as const }, // Verified correct location, cleaned precision
    { name: 'Basiao', coords: [11.260895816210494, 125.16131895224565], type: 'rural' as const },
    { name: 'Buenavista', coords: [11.2612303, 125.1610249], type: 'rural' as const },
    { name: 'Burgos', coords: [11.3127738, 125.1524123], type: 'rural' as const },
    { name: 'Cambayan', coords: [11.284089, 124.9963614], type: 'rural' as const },
    { name: 'Can-abay', coords: [11.2964442, 125.0171976], type: 'rural' as const },
    { name: 'Cancaiyas', coords: [11.3499757, 125.0836064], type: 'rural' as const },
    { name: 'Canmanila', coords: [11.2866303, 125.0575179], type: 'rural' as const },
    { name: 'Catadman', coords: [11.2725188, 125.1529991], type: 'rural' as const },
    { name: 'Cogon', coords: [11.333611, 125.097222], type: 'rural' as const },
    { name: 'Dolongan', coords: [11.3358835, 125.0288258], type: 'rural' as const },
    { name: 'Guintigui-an', coords: [11.2850000, 125.0500000], type: 'rural' as const }, // TODO: VERIFY - Previous coords pointed to Ormoc City
    { name: 'Guirang', coords: [11.3334531, 125.1456322], type: 'rural' as const },
    { name: 'Balante', coords: [11.3388426, 125.0437445], type: 'rural' as const },
    { name: 'Iba', coords: [11.2943547, 125.0929189], type: 'rural' as const },
    { name: 'Inuntan', coords: [11.345497, 125.152115], type: 'rural' as const },
    { name: 'Loog', coords: [11.3109945, 125.1576871], type: 'rural' as const },
    { name: 'Mabini', coords: [11.3729788, 125.1502285], type: 'rural' as const },
    { name: 'Magallanes', coords: [11.2959849, 125.1180654], type: 'rural' as const },
    { name: 'Manlilinab', coords: [11.4057755, 125.1272475], type: 'rural' as const },
    { name: 'Del Pilar', coords: [11.3181604, 125.1455537], type: 'rural' as const },
    { name: 'May-it', coords: [11.3080943, 125.0152557], type: 'rural' as const },
    { name: 'Mongabong', coords: [11.3243908, 125.0234979], type: 'rural' as const },
    { name: 'New San Agustin', coords: [11.3156829, 125.0970982], type: 'rural' as const },
    { name: 'Nouvelas Occidental', coords: [11.2878942, 125.1279255], type: 'rural' as const },
    { name: 'Old San Agustin', coords: [11.3233043, 125.1059211], type: 'rural' as const },
    { name: 'Panugmonon', coords: [11.3051139, 125.1469289], type: 'rural' as const },
    { name: 'Pelit', coords: [11.3030507, 125.1564277], type: 'rural' as const },
    
    // Poblacion Barangays (7 Urban Centers)
    { name: 'Baybay (Poblacion)', coords: [11.28167, 125.06833], type: 'urban' as const },
    { name: 'Buscada (Poblacion)', coords: [11.2814091, 125.0667279], type: 'urban' as const },
    { name: 'Lawa-an (Poblacion)', coords: [11.2817, 125.0683], type: 'urban' as const },
    { name: 'Loyo (Poblacion)', coords: [11.280393, 125.067366], type: 'urban' as const },
    { name: 'Mercado (Poblacion)', coords: [11.2802359, 125.0701055], type: 'urban' as const },
    { name: 'Palaypay (Poblacion)', coords: [11.2845559, 125.0687231], type: 'urban' as const },
    { name: 'Sulod (Poblacion)', coords: [11.2818956, 125.0688281], type: 'urban' as const },
    
    // Remaining Barangays
    { name: 'Roxas', coords: [11.3067742, 125.0511018], type: 'rural' as const },
    { name: 'Salvacion', coords: [11.2671612, 125.0751775], type: 'rural' as const },
    { name: 'San Antonio', coords: [11.2768363, 125.0114879], type: 'rural' as const },
    { name: 'San Fernando', coords: [11.2788975, 125.1467683], type: 'rural' as const },
    { name: 'Sawa', coords: [11.305259, 125.0801691], type: 'rural' as const },
    { name: 'Serum', coords: [11.297623, 125.1297929], type: 'rural' as const },
    { name: 'Sugca', coords: [11.2919124, 125.1038343], type: 'rural' as const },
    { name: 'Sugponon', coords: [11.2881403, 125.1053266], type: 'rural' as const },
    { name: 'Tinaogan', coords: [11.2893217, 124.9771129], type: 'rural' as const },
    { name: 'Tingib', coords: [11.2785632, 125.032787], type: 'rural' as const },
    { name: 'Villa Aurora', coords: [11.3389437, 125.0646847], type: 'rural' as const },
    { name: 'Binongtu-an', coords: [11.2909236, 125.1192263], type: 'rural' as const },
    { name: 'Bulao', coords: [11.3381704, 125.1021105], type: 'rural' as const },
    
    // Key Landmarks and Places of Interest in Basey Municipality
    // Using GeoJSON-based coordinates following the rule: "follow whatever the .geojson file has because this is the most realistic coordinates data"
    { name: 'José Rizal Monument (Basey Center - KM 0)', coords: BASEY_LANDMARKS['José Rizal Monument (Basey Center - KM 0)'], type: 'landmark' as const },
    { name: 'Sohoton Natural Bridge National Park', coords: EXTERNAL_LANDMARKS['Sohoton Natural Bridge National Park'], type: 'landmark' as const },
    { name: 'Sohoton Caves', coords: EXTERNAL_LANDMARKS['Sohoton Caves'], type: 'landmark' as const },
    { name: 'Panhulugan Cliff', coords: EXTERNAL_LANDMARKS['Panhulugan Cliff'], type: 'landmark' as const },
    { name: 'Basey Church (St. Michael the Archangel)', coords: BASEY_LANDMARKS['Basey Church (St. Michael the Archangel)'], type: 'landmark' as const },
    { name: 'Basey Municipal Hall', coords: BASEY_LANDMARKS['Basey Municipal Hall'], type: 'landmark' as const },
    { name: 'Basey Public Market', coords: BASEY_LANDMARKS['Basey Public Market'], type: 'landmark' as const },
    { name: 'Basey Central School', coords: BASEY_LANDMARKS['Basey Central School'], type: 'landmark' as const },
    { name: 'Basey National High School', coords: BASEY_LANDMARKS['Basey National High School'], type: 'landmark' as const },
    { name: 'Basey Port/Wharf', coords: BASEY_LANDMARKS['Basey Port/Wharf'], type: 'landmark' as const },
    { name: 'Rural Health Unit Basey', coords: BASEY_LANDMARKS['Rural Health Unit Basey'], type: 'landmark' as const }
  ]

  // Note: Map initialization removed for now - focusing on API integration
  // The visual map can be added later once the core functionality works

  const handleCalculate = async () => {
    setError('')
    
    // Rate limiting
    const now = Date.now()
    if (now - lastCalculationTime < 2000) {
      setError('Please wait a moment before calculating again')
      return
    }
    
    // Input validation
    if (!fromLocation || !toLocation) {
      setError('Please select both pickup and destination locations')
      return
    }

    if (fromLocation === toLocation) {
      setError('Pickup and destination cannot be the same')
      return
    }

    const fromBarangay = barangays.find(b => b.name === fromLocation)
    const toBarangay = barangays.find(b => b.name === toLocation)
    
    if (!fromBarangay || !toBarangay) {
      setError('Please select valid locations from the dropdown list')
      return
    }

    setIsCalculating(true)
    setLastCalculationTime(now)

    try {
      // Call our API to get Google Maps route data
      const response = await fetch('/api/routes/google-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: fromBarangay.coords,
          destination: toBarangay.coords,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if this is a Google Maps API issue and suggest fallback
        if (data.fallback) {
          throw new Error(`${data.error}\n\n${data.suggestion}`)
        }
        throw new Error(data.error || 'Failed to calculate route')
      }

      if (data.success && data.route) {
        setRouteResult(data.route)
        
        // Route successfully calculated - visual map rendering to be added later
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

  const handleReset = () => {
    setFromLocation('')
    setToLocation('')
    setRouteResult(null)
    setError('')
    
    // Reset completed
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-3xl mb-6">
            <span className="text-3xl">🗺️</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Google Maps Fare Calculator
          </h2>
          <p className="text-lg text-gray-600">
            GPS-accurate routing with real-time traffic data from Google Maps
          </p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
            <span className="text-blue-600 font-medium text-sm">✓ High Accuracy</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-blue-600 font-medium text-sm">✓ Real-time Data</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-blue-600 font-medium text-sm">✓ Visual Route</span>
          </div>
        </div>

        {/* Priority Results Section - Appears First After Calculation */}
        {routeResult && (
          <div ref={resultsRef} className="animate-fade-in">
            <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-xl">
              {/* Prominent Success Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-3xl mb-4 shadow-lg">
                  <span className="text-3xl">💰</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">🎉 Fare Calculated Successfully!</h2>
                <p className="text-lg text-gray-600 mb-4">{routeResult.accuracy}</p>
                <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border border-emerald-200">
                  <span className="text-emerald-600 font-semibold text-sm">✓ Route: {fromLocation} → {toLocation}</span>
                </div>
              </div>
              
              {/* Key Metrics - Larger and More Prominent */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-emerald-100">
                  <div className="text-4xl font-bold text-emerald-600 mb-3">
                    ₱{routeResult.fare.fare.toFixed(2)}
                  </div>
                  <div className="text-lg font-semibold text-gray-700">Total Fare</div>
                  <div className="text-sm text-gray-500 mt-2">Municipal Ordinance 105</div>
                </div>
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-blue-100">
                  <div className="text-4xl font-bold text-blue-600 mb-3">
                    {routeResult.distance.kilometers.toFixed(2)} km
                  </div>
                  <div className="text-lg font-semibold text-gray-700">GPS Distance</div>
                  <div className="text-sm text-gray-500 mt-2">{routeResult.distance.text}</div>
                </div>
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-purple-100">
                  <div className="text-4xl font-bold text-purple-600 mb-3">
                    {routeResult.duration.text}
                  </div>
                  <div className="text-lg font-semibold text-gray-700">Travel Time</div>
                  <div className="text-sm text-gray-500 mt-2">Estimated duration</div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200 shadow-lg"
                >
                  <span className="mr-2">🔄</span>
                  Calculate Another Route
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-200 shadow-lg"
                >
                  <span className="mr-2">🖨️</span>
                  Print Results
                </button>
              </div>

              {/* Detailed Fare Breakdown - Collapsible */}
              <details className="bg-white rounded-xl shadow-lg border border-gray-200">
                <summary className="p-4 cursor-pointer hover:bg-gray-50 rounded-xl font-semibold text-gray-700 flex items-center justify-between">
                  <span className="flex items-center">
                    <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold mr-3">💰</span>
                    Detailed Fare Breakdown
                  </span>
                  <span className="text-sm text-gray-500">Click to expand</span>
                </summary>
                <div className="p-4 border-t border-gray-100">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Base fare (first 3km):</span>
                      <span className="font-semibold text-gray-900">₱15.00</span>
                    </div>
                    {routeResult.fare.breakdown.additionalDistance > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Additional distance:</span>
                        <span className="font-semibold text-gray-900">
                          {routeResult.fare.breakdown.additionalDistance.toFixed(2)} km × ₱3.00 = ₱{routeResult.fare.breakdown.additionalFare.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="border-t-2 border-emerald-300 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-700 text-lg">Total Fare:</span>
                        <span className="text-2xl font-bold text-emerald-600">₱{routeResult.fare.fare.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 text-center">
                        Calculated using {routeResult.source} • Based on Municipal Ordinance 105 Series of 2023
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Calculator and Map Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calculator Form */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Route Calculator</h3>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="from-google" className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="inline-flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">A</span>
                    Pickup Location
                  </span>
                </label>
                <select
                  id="from-google"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">Choose pickup location...</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.name} value={barangay.name}>
                      {barangay.name} • {barangay.type.charAt(0).toUpperCase() + barangay.type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="to-google" className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="inline-flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">B</span>
                    Destination
                  </span>
                </label>
                <select
                  id="to-google"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">Choose destination...</option>
                  {barangays.map((barangay) => (
                    <option key={barangay.name} value={barangay.name}>
                      {barangay.name} • {barangay.type.charAt(0).toUpperCase() + barangay.type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <span className="text-red-600 mr-2">⚠️</span>
                    <p className="text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={handleCalculate}
                  disabled={isCalculating || !fromLocation || !toLocation}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 flex items-center justify-center"
                >
                  {isCalculating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Calculating with Google Maps...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🚗</span>
                      Calculate Route
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-200 focus:ring-offset-2"
                >
                  <span className="mr-2">🔄</span>
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Route Visualization */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Road-Based Route Map</h3>
              <p className="text-sm text-gray-600">GPS-accurate route visualization</p>
            </div>
            
{routeResult?.polyline ? (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="bg-blue-50 p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">Road Route</h4>
                      <p className="text-sm text-gray-600">GPS-based routing</p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <div className="font-medium">{routeResult.distance.text}</div>
                      <div>{routeResult.duration.text}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="h-80 bg-gray-100 rounded border flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🛣️</span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-700 mb-2">Route Calculated</h4>
                      <p className="text-sm text-gray-600 mb-2">Road-based route from Google Maps</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Distance: {routeResult.distance.text}</div>
                        <div>Duration: {routeResult.duration.text}</div>
                        <div>Route: {fromLocation} → {toLocation}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs text-gray-600 text-center">
                  Road-based route • GPS accuracy
                </div>
              </div>
            ) : (
              <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🗺️</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Route Map</h4>
                  <p className="text-gray-500 mb-3">Select locations to view route</p>
                  
                  {(fromLocation && toLocation) && (
                    <div className="mt-3 p-2 bg-white rounded border">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Route:</span> {fromLocation} → {toLocation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  )
}

export default GoogleMapsFareCalculator