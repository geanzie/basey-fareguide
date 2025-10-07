'use client'

import { useState, useRef, useEffect } from 'react'
import { barangayService } from '../lib/barangayService'
import { BarangayInfo } from '../utils/barangayBoundaries'
import EnhancedRouteMap from './EnhancedRouteMap'

// Route Planner uses Google Maps API for accurate road-based distance calculation
// GPS direct distance calculation is not used here as it would be unfair to drivers

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
  barangayInfo?: {
    originBarangay: string
    destinationBarangay: string
    crossesBoundary: boolean
    recommendations: string[]
  }
}

interface RoutePlannerCalculatorProps {
  onError?: (error: string) => void
}

const RoutePlannerCalculator = ({ onError }: RoutePlannerCalculatorProps) => {
  const [fromLocation, setFromLocation] = useState('')
  const [toLocation, setToLocation] = useState('')
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string>('')
  const [lastCalculationTime, setLastCalculationTime] = useState<number>(0)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [barangayList, setBarangayList] = useState<BarangayInfo[]>([])
  const [showEnhancedMap, setShowEnhancedMap] = useState(false)
  const [routeCoordinates, setRouteCoordinates] = useState<{ lat: number; lng: number }[]>([])
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number; name?: string } | null>(null)
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number; name?: string } | null>(null)
  const [savedToDatabase, setSavedToDatabase] = useState(false)

  // Initialize barangay data
  useEffect(() => {
    const initializeBarangays = async () => {
      try {
        await barangayService.initialize()
        const allBarangays = barangayService.getBarangays()
        setBarangayList(allBarangays)
      } catch (error) {
        console.error('Failed to initialize barangay data:', error)
      }
    }
    initializeBarangays()
  }, [])

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

  // Dynamic barangays loaded from comprehensive GeoJSON boundary data
  // Legacy format for backward compatibility
  const barangays = (barangayList.map(b => ({
    name: b.name,
    coords: [b.center[1], b.center[0]] as [number, number], // Convert lng,lat to lat,lng
    type: b.isPoblacion ? 'urban' as const : 'rural' as const
  })) as Array<{ name: string; coords: [number, number]; type: 'urban' | 'rural' | 'landmark' }>).concat([
    // Additional landmarks for enhanced functionality
    { name: 'José Rizal Monument (Basey Center - KM 0)', coords: [11.280182, 125.06918], type: 'landmark' as const },
    { name: 'Sohoton Natural Bridge National Park', coords: [11.3329711, 125.1442518], type: 'landmark' as const },
    { name: 'Sohoton Caves', coords: [11.3588068, 125.1586589], type: 'landmark' as const },
    { name: 'Panhulugan Cliff', coords: [11.3556, 125.0234], type: 'landmark' as const },
    { name: 'Basey Church (St. Michael the Archangel)', coords: [11.2809812, 125.0699803], type: 'landmark' as const },
    { name: 'Basey Municipal Hall', coords: [11.2801061, 125.0691729], type: 'landmark' as const },
    { name: 'Basey Public Market', coords: [11.2846003, 125.070559], type: 'landmark' as const },
    { name: 'Basey Central School', coords: [11.2817, 125.0683], type: 'landmark' as const },
    { name: 'Basey National High School', coords: [11.2847487, 125.0668604], type: 'landmark' as const },
    { name: 'Basey Port/Wharf', coords: [11.282514, 125.07155], type: 'landmark' as const },
    { name: 'Rural Health Unit Basey', coords: [11.2817, 125.0683], type: 'landmark' as const }
  ])

  // Note: Map initialization removed for now - focusing on API integration
  // The visual map can be added later once the core functionality works

  // Helper function to save fare calculation to database
  const saveFareCalculation = async (routeData: RouteResult) => {
    try {
      // Get auth token if available (for logged-in users)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/fare-calculations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fromLocation,
          toLocation,
          distance: routeData.distance.kilometers,
          calculatedFare: routeData.fare.fare,
          calculationType: 'Google Maps Route Planner',
          routeData: {
            distance: routeData.distance,
            duration: routeData.duration,
            polyline: routeData.polyline,
            source: routeData.source,
            accuracy: routeData.accuracy,
            barangayInfo: routeData.barangayInfo,
            fareBreakdown: routeData.fare.breakdown
          }
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        console.log('✅ Fare calculation saved to database:', result.calculation.id)
        setSavedToDatabase(true)
        // Auto-hide the success indicator after 3 seconds
        setTimeout(() => setSavedToDatabase(false), 3000)
      } else {
        console.warn('⚠️ Failed to save fare calculation to database:', result.error)
        // Don't show error to user since the calculation still worked
      }
    } catch (error) {
      console.warn('⚠️ Error saving fare calculation to database:', error)
      // Don't show error to user since the calculation still worked
    }
  }

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
        console.error('🚫 Google Maps API Error:', data);
        
        let errorMessage = 'Google Maps API is required for accurate road-based route calculation.'
        
        if (data.details) {
          errorMessage += `\n\nDetails: ${data.details}`
        }
        
        if (data.requiredSetup && Array.isArray(data.requiredSetup)) {
          errorMessage += '\n\nRequired Setup:\n' + data.requiredSetup.map((step: string) => `• ${step}`).join('\n')
        }
        
        if (data.apiKeyConfigured === false) {
          errorMessage += '\n\n🔑 API Key Status: Not configured'
        }
        
        throw new Error(errorMessage)
      }

      if (data.success && data.route) {
        setRouteResult(data.route)
        
        // Save the fare calculation to database (asynchronously, don't block UI)
        saveFareCalculation(data.route).catch(console.warn)
        
        // Route successfully calculated - visual map rendering to be added later
      } else {
        throw new Error('Invalid response from route calculation')
      }
    } catch (error) {
      console.error('Google Maps API error:', error)
      
      // No GPS fallback - this would be unfair to drivers as it doesn't account for actual road distance
      const errorMessage = 'Google Maps API is required for accurate road-based route calculation. Please configure the API key to ensure fair fare calculations based on actual driving distance.'
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
    setSavedToDatabase(false)
    
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
            Route Planner & Fare Calculator
          </h2>
          <p className="text-lg text-gray-600">
            Plan your trip and calculate fares between any two locations in Basey Municipality
          </p>
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 rounded-lg">
            <span className="text-blue-600 font-medium text-sm">✓ Pre-trip Planning</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-blue-600 font-medium text-sm">✓ Google Maps Accuracy</span>
            <span className="mx-2 text-gray-300">•</span>
            <span className="text-blue-600 font-medium text-sm">✓ All Barangays Covered</span>
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
                <h2 className="text-3xl font-bold text-gray-800 mb-2">🎉 Route Planned Successfully!</h2>
                <p className="text-lg text-gray-600 mb-4">{routeResult.accuracy}</p>
                <div className="flex flex-col gap-2 items-center">
                  <div className="inline-flex items-center px-4 py-2 bg-white rounded-full shadow-sm border border-emerald-200">
                    <span className="text-emerald-600 font-semibold text-sm">✓ Route: {fromLocation} → {toLocation}</span>
                  </div>
                  {savedToDatabase && (
                    <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium border border-blue-200 animate-pulse">
                      <span className="mr-1">💾</span>
                      Saved to History
                    </div>
                  )}
                </div>
              </div>
              
              {/* Key Metrics - Larger and More Prominent */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-emerald-100">
                  <div className="text-4xl font-bold text-emerald-600 mb-3">
                    ₱{routeResult.fare.fare.toFixed(2)}
                  </div>
                  <div className="text-lg font-semibold text-gray-700">Estimated Fare</div>
                  <div className="text-sm text-gray-500 mt-2">Municipal Ordinance 105</div>
                </div>
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-blue-100">
                  <div className="text-4xl font-bold text-blue-600 mb-3">
                    {routeResult.distance.kilometers.toFixed(2)} km
                  </div>
                  <div className="text-lg font-semibold text-gray-700">Route Distance</div>
                  <div className="text-sm text-gray-500 mt-2">{routeResult.distance.text}</div>
                </div>
                <div className="bg-white rounded-2xl p-8 text-center shadow-lg border border-purple-100">
                  <div className="text-4xl font-bold text-purple-600 mb-3">
                    {routeResult.duration.text}
                  </div>
                  <div className="text-lg font-semibold text-gray-700">Estimated Time</div>
                  <div className="text-sm text-gray-500 mt-2">Travel duration</div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200 shadow-lg"
                >
                  <span className="mr-2">🔄</span>
                  Plan Another Route
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-200 shadow-lg"
                >
                  <span className="mr-2">🖨️</span>
                  Print Route Plan
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
                        <span className="font-bold text-emerald-700 text-lg">Estimated Total Fare:</span>
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
            <h3 className="text-xl font-bold text-gray-900 mb-6">Plan Your Route</h3>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="from-planner" className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="inline-flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">A</span>
                    Starting Location
                  </span>
                </label>
                <select
                  id="from-planner"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">Choose starting location...</option>
                  
                  {/* Poblacion Barangays */}
                  <optgroup label="🏛️ Poblacion Areas (Urban Centers)">
                    {barangays.filter(b => b.type === 'urban').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Rural Barangays */}
                  <optgroup label="🌾 Rural Barangays">
                    {barangays.filter(b => b.type === 'rural').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Landmarks */}
                  <optgroup label="📍 Landmarks & Points of Interest">
                    {barangays.filter(b => b.type === 'landmark').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label htmlFor="to-planner" className="block text-sm font-semibold text-gray-700 mb-3">
                  <span className="inline-flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">B</span>
                    Destination
                  </span>
                </label>
                <select
                  id="to-planner"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white"
                >
                  <option value="">Choose destination...</option>
                  
                  {/* Poblacion Barangays */}
                  <optgroup label="🏛️ Poblacion Areas (Urban Centers)">
                    {barangays.filter(b => b.type === 'urban').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Rural Barangays */}
                  <optgroup label="🌾 Rural Barangays">
                    {barangays.filter(b => b.type === 'rural').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Landmarks */}
                  <optgroup label="📍 Landmarks & Points of Interest">
                    {barangays.filter(b => b.type === 'landmark').map((barangay) => (
                      <option key={barangay.name} value={barangay.name}>
                        {barangay.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <span className="text-red-600 mr-3 text-xl">🚫</span>
                    <div className="flex-1">
                      <p className="text-red-800 font-semibold mb-2">Google Maps API Required</p>
                      <p className="text-red-700 mb-3">{error}</p>
                      <div className="bg-red-100 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-red-800 mb-2">Why This Matters:</p>
                        <ul className="text-red-700 space-y-1 list-disc list-inside">
                          <li>GPS direct distance: San Antonio to Basiao = ~7.6km</li>
                          <li>Actual road distance: San Antonio to Basiao = ~21km</li>
                          <li>Using GPS would undercharge by ₱40+ per trip!</li>
                        </ul>
                      </div>
                      <div className="mt-3 text-xs text-red-600">
                        <strong>Setup Required:</strong> Configure GOOGLE_MAPS_SERVER_API_KEY in .env.local file
                      </div>
                    </div>
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
                      Planning Route...
                    </>
                  ) : (
                    <>
                      <span className="mr-2">🗺️</span>
                      Plan Route & Calculate Fare
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
              <h3 className="text-xl font-bold text-gray-900 mb-2">Planned Route Preview</h3>
              <p className="text-sm text-gray-600">Visual representation of your planned route</p>
            </div>
            
            {routeResult?.polyline ? (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="bg-blue-50 p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-800">Planned Route</h4>
                      <p className="text-sm text-gray-600">Google Maps routing</p>
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
                      <h4 className="text-lg font-semibold text-gray-700 mb-2">Route Planned</h4>
                      <p className="text-sm text-gray-600 mb-2">Optimal route calculated</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Distance: {routeResult.distance.text}</div>
                        <div>Duration: {routeResult.duration.text}</div>
                        <div>Route: {fromLocation} → {toLocation}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs text-gray-600 text-center">
                  Google Maps routing • Optimized for efficiency
                </div>
              </div>
            ) : (
              <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <div className="text-center p-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🗺️</span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">Route Preview</h4>
                  <p className="text-gray-500 mb-3">Select locations to plan your route</p>
                  
                  {(fromLocation && toLocation) && (
                    <div className="mt-3 p-2 bg-white rounded border">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Planning:</span> {fromLocation} → {toLocation}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Barangay Map Toggle */}
          {routeResult && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Enhanced Route Visualization</h3>
                <button
                  onClick={() => setShowEnhancedMap(!showEnhancedMap)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    showEnhancedMap
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {showEnhancedMap ? 'Hide Barangay Boundaries' : 'Show Barangay Boundaries'}
                </button>
              </div>
              
              {showEnhancedMap && (
                <EnhancedRouteMap
                  origin={originCoords || undefined}
                  destination={destCoords || undefined}
                  route={routeCoordinates}
                  showBarangayBoundaries={true}
                  className="w-full h-96"
                />
              )}
            </div>
          )}

          {/* Barangay Information */}
          {routeResult?.barangayInfo && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                🗺️ Geographic Route Analysis
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">Origin Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Barangay:</span> {routeResult.barangayInfo.originBarangay}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {
                        barangayList.find(b => b.name === routeResult.barangayInfo?.originBarangay)?.isPoblacion
                          ? '🏛️ Poblacion (Urban)'
                          : '🌾 Rural Area'
                      }
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Destination Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Barangay:</span> {routeResult.barangayInfo.destinationBarangay}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {
                        barangayList.find(b => b.name === routeResult.barangayInfo?.destinationBarangay)?.isPoblacion
                          ? '🏛️ Poblacion (Urban)'
                          : '🌾 Rural Area'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {routeResult.barangayInfo.crossesBoundary && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h5 className="font-medium text-amber-800 mb-2 flex items-center">
                    ⚠️ Cross-Barangay Route
                  </h5>
                  <p className="text-sm text-amber-700">
                    This route crosses barangay boundaries. Additional fees may apply according to local transportation policies.
                  </p>
                </div>
              )}

              {routeResult.barangayInfo.recommendations.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-gray-800 mb-2">Route Recommendations</h5>
                  <div className="space-y-2">
                    {routeResult.barangayInfo.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start text-sm text-gray-600">
                        <span className="mr-2 text-blue-500">•</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoutePlannerCalculator