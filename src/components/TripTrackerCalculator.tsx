'use client'

import { useState, useEffect } from 'react'

interface GPSPosition {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
}

interface RouteSegment {
  startPosition: GPSPosition
  endPosition: GPSPosition
  distance: number
  duration: number
  googleMapsDistance?: number
  googleMapsDuration?: number
  useGoogleMaps: boolean
}

interface TripData {
  startPosition: GPSPosition | null
  endPosition: GPSPosition | null
  totalDistance: number
  googleMapsDistance: number
  duration: number
  fare: number
  isActive: boolean
  waypoints: GPSPosition[]
  routeSegments: RouteSegment[]
  lastGoogleMapsUpdate: number
}

const TripTrackerCalculator = () => {
  const [tripData, setTripData] = useState<TripData>({
    startPosition: null,
    endPosition: null,
    totalDistance: 0,
    googleMapsDistance: 0,
    duration: 0,
    fare: 0,
    isActive: false,
    waypoints: [],
    routeSegments: [],
    lastGoogleMapsUpdate: 0
  })
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setIsSupported(false)
      setGpsError('GPS/Geolocation is not supported by your browser')
      return
    }

    // Get current position on load
    getCurrentPosition()
  }, [])

  useEffect(() => {
    let watchId: number | null = null

    if (tripData.isActive) {
      // Start watching position during active trip
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition: GPSPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          }

          setCurrentPosition(newPosition)
          
          // Update trip data immediately for real-time tracking
          setTripData(prev => {
            // Only add position if it's significantly different from the last position
            // This filters GPS noise but allows real movement detection
            const shouldAddPosition = prev.waypoints.length === 0 || 
              calculateDistance(prev.waypoints[prev.waypoints.length - 1], newPosition) >= 0.001 || // 1 meter minimum
              newPosition.accuracy <= 10 // Always add high-accuracy readings
            
            const updatedWaypoints = shouldAddPosition 
              ? [...prev.waypoints, newPosition]
              : prev.waypoints
            
            // Calculate GPS-based distance from all waypoints
            let gpsDistance = 0
            for (let i = 1; i < updatedWaypoints.length; i++) {
              const segmentDistance = calculateDistance(updatedWaypoints[i - 1], updatedWaypoints[i])
              gpsDistance += segmentDistance
            }
            gpsDistance = Math.round(gpsDistance * 100) / 100
            
            // Log real-time updates for debugging
            if (shouldAddPosition) {
              console.log(`Real-time update: ${gpsDistance.toFixed(3)}km, ${updatedWaypoints.length} points, accuracy: ${newPosition.accuracy}m`)
            }

            const duration = prev.startPosition 
              ? (newPosition.timestamp - prev.startPosition.timestamp) / 1000 / 60 // minutes
              : 0

            // Use Google Maps distance for fare calculation if available, otherwise fall back to GPS
            const distanceForFare = prev.googleMapsDistance > 0 ? prev.googleMapsDistance : gpsDistance
            const fare = calculateFare(distanceForFare)

            const newTripData = {
              ...prev,
              totalDistance: gpsDistance,
              duration,
              fare,
              waypoints: updatedWaypoints
            }

            // Update Google Maps route every 30 seconds or every 500 meters of GPS movement
            const timeSinceLastUpdate = Date.now() - prev.lastGoogleMapsUpdate
            const shouldUpdateGoogleMaps = 
              timeSinceLastUpdate > 30000 || // 30 seconds
              (prev.startPosition && gpsDistance - (prev.googleMapsDistance || 0) > 0.5) // 500 meters difference

            if (shouldUpdateGoogleMaps && prev.startPosition) {
              // Update Google Maps route asynchronously
              getGoogleMapsRoute(prev.startPosition, newPosition).then(routeData => {
                if (routeData) {
                  setTripData(currentData => ({
                    ...currentData,
                    googleMapsDistance: routeData.distance,
                    fare: calculateFare(routeData.distance),
                    lastGoogleMapsUpdate: Date.now()
                  }))
                }
              }).catch(error => {
                console.warn('Failed to update Google Maps route:', error)
              })
            }

            return newTripData
          })
        },
        (error) => {
          setGpsError(`GPS Error: ${error.message}`)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 1000 // Use more recent GPS data for better real-time tracking
        }
      )
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [tripData.isActive, tripData.startPosition])

  const getCurrentPosition = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy
        }
        setCurrentPosition(newPosition)
        setGpsError(null)
      },
      (error) => {
        setGpsError(`GPS Error: ${error.message}`)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    )
  }

  const calculateDistance = (pos1: GPSPosition, pos2: GPSPosition): number => {
    const R = 6371000 // Earth's radius in meters
    const lat1Rad = pos1.latitude * Math.PI / 180
    const lat2Rad = pos2.latitude * Math.PI / 180
    const deltaLatRad = (pos2.latitude - pos1.latitude) * Math.PI / 180
    const deltaLngRad = (pos2.longitude - pos1.longitude) * Math.PI / 180

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    // Return distance in kilometers with high precision
    return Math.round((R * c / 1000) * 100) / 100 // Round to hundredths (0.01 km precision)
  }

  const calculateFare = (distance: number): number => {
    const baseFare = 15.00 // First 3km
    const baseDistance = 3.0
    const additionalRate = 3.00 // Per additional km

    if (distance <= baseDistance) {
      return baseFare
    }

    // Calculate precise fare without rounding up distance
    const additionalDistance = distance - baseDistance
    const additionalFare = additionalDistance * additionalRate
    
    // Round final fare to nearest centavo (0.01)
    return Math.round((baseFare + additionalFare) * 100) / 100
  }

  const getGoogleMapsRoute = async (origin: GPSPosition, destination: GPSPosition): Promise<{distance: number, duration: number} | null> => {
    try {
      const response = await fetch('/api/routes/google-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: [origin.latitude, origin.longitude],
          destination: [destination.latitude, destination.longitude]
        })
      })

      if (!response.ok) {
        console.warn('Google Maps API request failed:', response.status)
        return null
      }

      const data = await response.json()
      
      if (data.success && data.route) {
        return {
          distance: data.route.distance.kilometers,
          duration: data.route.duration.seconds / 60 // Convert to minutes
        }
      }
      
      return null
    } catch (error) {
      console.warn('Error calling Google Maps API:', error)
      return null
    }
  }



  const startTrip = () => {
    if (!currentPosition) {
      setGpsError('Please wait for GPS to get your current location')
      return
    }

    setTripData({
      startPosition: currentPosition,
      endPosition: null,
      totalDistance: 0,
      googleMapsDistance: 0,
      duration: 0,
      fare: 15.00, // Base fare
      isActive: true,
      waypoints: [currentPosition],
      routeSegments: [],
      lastGoogleMapsUpdate: Date.now()
    })
    setGpsError(null)
  }

  const endTrip = async () => {
    if (!currentPosition) {
      setGpsError('Cannot end trip without GPS position')
      return
    }

    setTripData(prev => ({
      ...prev,
      endPosition: currentPosition,
      isActive: false
    }))

    // Get final Google Maps route for the most accurate total
    if (tripData.startPosition) {
      try {
        const finalRoute = await getGoogleMapsRoute(tripData.startPosition, currentPosition)
        if (finalRoute) {
          setTripData(prev => ({
            ...prev,
            googleMapsDistance: finalRoute.distance,
            fare: calculateFare(finalRoute.distance)
          }))
        }
      } catch (error) {
        console.warn('Failed to get final Google Maps route:', error)
      }
    }
  }

  const resetTrip = () => {
    setTripData({
      startPosition: null,
      endPosition: null,
      totalDistance: 0,
      googleMapsDistance: 0,
      duration: 0,
      fare: 0,
      isActive: false,
      waypoints: [],
      routeSegments: [],
      lastGoogleMapsUpdate: 0
    })
    setGpsError(null)
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const formatAccuracy = (accuracy: number): string => {
    if (accuracy < 10) return 'Excellent'
    if (accuracy < 30) return 'Good'
    if (accuracy < 100) return 'Fair'
    return 'Poor'
  }

  if (!isSupported) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📵</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            GPS Not Supported
          </h2>
          <p className="text-gray-600 mb-6">
            Your browser or device doesn't support GPS/Geolocation features required for trip tracking.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
            <h3 className="font-semibold text-blue-800 mb-2">Suggestions:</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Use a modern browser (Chrome, Firefox, Safari)</li>
              <li>• Enable location services on your device</li>
              <li>• Try the Route Planner instead for pre-trip planning</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Live Trip Tracker & Fare Calculator
        </h2>
        <p className="text-gray-600">
          Real-time trip tracking with GPS enhanced by Google Maps routing for accurate fare calculation
        </p>
      </div>

      {/* GPS Status */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
          <span className="mr-2">📍</span>
          GPS Status
        </h3>
        
        {currentPosition ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between">
              <span>Latitude:</span>
              <span className="font-mono">{currentPosition.latitude.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Longitude:</span>
              <span className="font-mono">{currentPosition.longitude.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span>Accuracy:</span>
              <span className={`font-semibold ${
                currentPosition.accuracy < 10 ? 'text-green-600' :
                currentPosition.accuracy < 30 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {formatAccuracy(currentPosition.accuracy)} ({currentPosition.accuracy.toFixed(0)}m)
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2"></div>
            <p>Getting your location...</p>
          </div>
        )}

        {gpsError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {gpsError}
          </div>
        )}
      </div>

      {/* Trip Controls */}
      <div className="flex justify-center space-x-4 mb-6">
        {!tripData.isActive ? (
          <button
            onClick={startTrip}
            disabled={!currentPosition}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
          >
            <span className="mr-2">🚀</span>
            Start Trip Tracking
          </button>
        ) : (
          <button
            onClick={endTrip}
            className="bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center"
          >
            <span className="mr-2">🏁</span>
            End Trip
          </button>
        )}

        <button
          onClick={resetTrip}
          className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center"
        >
          <span className="mr-2">🔄</span>
          Reset
        </button>

        <button
          onClick={getCurrentPosition}
          className="border border-blue-300 text-blue-700 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center"
        >
          <span className="mr-2">📍</span>
          Refresh GPS
        </button>
      </div>

      {/* Trip Status */}
      {tripData.isActive && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
              <h3 className="font-semibold text-green-800">Trip in Progress</h3>
            </div>
            <div className="flex items-center text-sm">
              {tripData.googleMapsDistance > 0 ? (
                <div className="flex items-center text-blue-600">
                  <span className="mr-1">🗺️</span>
                  Google Maps Active
                </div>
              ) : (
                <div className="flex items-center text-orange-600">
                  <span className="mr-1">📍</span>
                  GPS Tracking
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ₱{tripData.fare.toFixed(2)}
              </div>
              <div className="text-green-700">Current Fare</div>
              <div className="text-xs text-green-600 mt-1">
                {tripData.googleMapsDistance > 0 ? 'Google Maps' : 'GPS-based'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {tripData.googleMapsDistance > 0 ? tripData.googleMapsDistance.toFixed(2) : tripData.totalDistance.toFixed(2)} km
              </div>
              <div className="text-green-700">Route Distance</div>
              <div className="text-xs text-green-600 mt-1">
                GPS: {tripData.totalDistance.toFixed(2)} km
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(tripData.duration)}
              </div>
              <div className="text-green-700">Duration</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {tripData.waypoints.length}
              </div>
              <div className="text-green-700">GPS Points</div>
              <div className="text-xs text-green-600 mt-1">
                {currentPosition && (
                  <>Updated {Math.round((Date.now() - currentPosition.timestamp) / 1000)}s ago</>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Summary */}
      {tripData.endPosition && !tripData.isActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            Trip Completed - Final Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Total Fare</h4>
                <div className="text-3xl font-bold text-blue-600">
                  ₱{tripData.fare.toFixed(2)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Distance Traveled</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {tripData.googleMapsDistance > 0 ? tripData.googleMapsDistance.toFixed(2) : tripData.totalDistance.toFixed(2)} km
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {tripData.googleMapsDistance > 0 ? (
                    <>
                      <div className="text-green-600 font-semibold">✓ Google Maps Route</div>
                      <div>GPS tracking: {tripData.totalDistance.toFixed(2)} km</div>
                    </>
                  ) : (
                    <div className="text-orange-600">GPS-based calculation</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Trip Duration</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {formatDuration(tripData.duration)}
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">GPS Accuracy</h4>
                <div className="text-sm space-y-1">
                  <div>Start: {tripData.startPosition ? formatAccuracy(tripData.startPosition.accuracy) : 'N/A'}</div>
                  <div>End: {formatAccuracy(tripData.endPosition.accuracy)}</div>
                  <div>Total Points: {tripData.waypoints.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Fare Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Base fare (first 3km):</span>
                <span className="font-semibold">₱15.00</span>
              </div>
              {(tripData.googleMapsDistance > 0 ? tripData.googleMapsDistance : tripData.totalDistance) > 3 && (
                <>
                  <div className="flex justify-between">
                    <span>Additional distance:</span>
                    <span>{((tripData.googleMapsDistance > 0 ? tripData.googleMapsDistance : tripData.totalDistance) - 3).toFixed(2)} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Additional fare (₱3/km):</span>
                    <span className="font-semibold">₱{(tripData.fare - 15).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">📝 How to Use Trip Tracker</h3>
        <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
          <li>Allow location access when prompted by your browser</li>
          <li>Wait for GPS to acquire your current position</li>
          <li>Click "Start Trip Tracking" when you begin your journey</li>
          <li>Keep the app open during your trip for accurate real-time tracking</li>
          <li>Click "End Trip" when you reach your destination</li>
          <li>View your complete trip summary and final fare</li>
        </ol>
      </div>

      {/* Accuracy Notice */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🎯 Enhanced Tracking Accuracy</h3>
        <div className="text-blue-700 text-sm space-y-2">
          <p>
            <strong>Hybrid Tracking System:</strong> This tracker uses both continuous GPS monitoring and periodic Google Maps routing for maximum accuracy.
          </p>
          <p>
            <strong>How it works:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Real-time GPS:</strong> Tracks your exact movement every few seconds</li>
            <li><strong>Google Maps Updates:</strong> Calculates actual road distances every 30 seconds</li>
            <li><strong>Smart Switching:</strong> Automatically uses the most accurate method available</li>
            <li><strong>Final Verification:</strong> Gets precise Google Maps route when trip ends</li>
          </ul>
          <p>
            <strong>Accuracy Levels:</strong>
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>🗺️ <strong>Google Maps:</strong> Highest accuracy using actual road networks</li>
            <li>📍 <strong>GPS Tracking:</strong> High accuracy using real-time positioning</li>
          </ul>
          <p>
            <strong>Precision:</strong> All calculations are accurate to 0.01 km distance and 0.01 peso fare.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TripTrackerCalculator