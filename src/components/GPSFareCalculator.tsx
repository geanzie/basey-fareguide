'use client'

import { useState, useEffect } from 'react'

interface GPSPosition {
  latitude: number
  longitude: number
  timestamp: number
  accuracy: number
}

interface TripData {
  startPosition: GPSPosition | null
  endPosition: GPSPosition | null
  totalDistance: number
  duration: number
  fare: number
  isActive: boolean
  waypoints: GPSPosition[]
}

const GPSFareCalculator = () => {
  const [tripData, setTripData] = useState<TripData>({
    startPosition: null,
    endPosition: null,
    totalDistance: 0,
    duration: 0,
    fare: 0,
    isActive: false,
    waypoints: []
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
          updateTripData(newPosition)
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

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [tripData.isActive])

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

    return R * c / 1000 // Convert to kilometers
  }

  const calculateFare = (distance: number): number => {
    const baseFare = 15.00 // First 3km
    const baseDistance = 3.0
    const additionalRate = 3.00 // Per additional km

    if (distance <= baseDistance) {
      return baseFare
    }

    const additionalDistance = distance - baseDistance
    const additionalFare = Math.ceil(additionalDistance) * additionalRate
    return baseFare + additionalFare
  }

  const updateTripData = (newPosition: GPSPosition) => {
    setTripData(prev => {
      const updatedWaypoints = [...prev.waypoints, newPosition]
      
      // Calculate total distance from all waypoints
      let totalDistance = 0
      for (let i = 1; i < updatedWaypoints.length; i++) {
        totalDistance += calculateDistance(updatedWaypoints[i - 1], updatedWaypoints[i])
      }

      const duration = prev.startPosition 
        ? (newPosition.timestamp - prev.startPosition.timestamp) / 1000 / 60 // minutes
        : 0

      const fare = calculateFare(totalDistance)

      return {
        ...prev,
        totalDistance,
        duration,
        fare,
        waypoints: updatedWaypoints
      }
    })
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
      duration: 0,
      fare: 15.00, // Base fare
      isActive: true,
      waypoints: [currentPosition]
    })
    setGpsError(null)
  }

  const endTrip = () => {
    if (!currentPosition) {
      setGpsError('Cannot end trip without GPS position')
      return
    }

    setTripData(prev => ({
      ...prev,
      endPosition: currentPosition,
      isActive: false
    }))
  }

  const resetTrip = () => {
    setTripData({
      startPosition: null,
      endPosition: null,
      totalDistance: 0,
      duration: 0,
      fare: 0,
      isActive: false,
      waypoints: []
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
            Your browser or device doesn't support GPS/Geolocation features required for this calculator.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
            <h3 className="font-semibold text-blue-800 mb-2">Suggestions:</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Use a modern browser (Chrome, Firefox, Safari)</li>
              <li>• Enable location services on your device</li>
              <li>• Try the Route Calculator instead</li>
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
          GPS-Based Fare Calculator
        </h2>
        <p className="text-gray-600">
          Real-time fare calculation using your device's GPS tracking
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
            Start Trip
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
          <div className="flex items-center mb-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-3"></div>
            <h3 className="font-semibold text-green-800">Trip in Progress</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tripData.totalDistance.toFixed(2)} km
              </div>
              <div className="text-green-700">Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ₱{tripData.fare.toFixed(2)}
              </div>
              <div className="text-green-700">Current Fare</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatDuration(tripData.duration)}
              </div>
              <div className="text-green-700">Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tripData.waypoints.length}
              </div>
              <div className="text-green-700">GPS Points</div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Summary */}
      {tripData.endPosition && !tripData.isActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            Trip Summary
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
                  {tripData.totalDistance.toFixed(2)} km
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
              {tripData.totalDistance > 3 && (
                <>
                  <div className="flex justify-between">
                    <span>Additional distance:</span>
                    <span>{(tripData.totalDistance - 3).toFixed(2)} km</span>
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
        <h3 className="font-semibold text-yellow-800 mb-2">📝 How to Use</h3>
        <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
          <li>Allow location access when prompted by your browser</li>
          <li>Wait for GPS to acquire your current position</li>
          <li>Click "Start Trip" when you begin your journey</li>
          <li>Keep the app open during your trip for accurate tracking</li>
          <li>Click "End Trip" when you reach your destination</li>
          <li>View your trip summary and total fare</li>
        </ol>
      </div>
    </div>
  )
}

export default GPSFareCalculator
