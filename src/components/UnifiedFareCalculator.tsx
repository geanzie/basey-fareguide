'use client'

import { useState, useEffect } from 'react'
import GoogleMapsFareCalculator from './GoogleMapsFareCalculator'
import SmartFareCalculator from './SmartFareCalculator'

interface UnifiedCalculatorProps {
  defaultMode?: 'google-maps' | 'gps' | 'auto'
}

export default function UnifiedFareCalculator({ defaultMode = 'auto' }: UnifiedCalculatorProps) {
  const [currentMode, setCurrentMode] = useState<'google-maps' | 'gps'>('google-maps')
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null)
  const [showFallbackMessage, setShowFallbackMessage] = useState(false)

  useEffect(() => {
    if (defaultMode === 'gps') {
      setCurrentMode('gps')
    } else if (defaultMode === 'google-maps') {
      setCurrentMode('google-maps')
    }
  }, [defaultMode])

  const handleGoogleMapsError = (error: string) => {
    setGoogleMapsError(error)
    
    // Check if this is an API limitation error that suggests fallback
    if (error.includes('API limitations') || error.includes('fallback') || error.includes('Try the GPS-based')) {
      setShowFallbackMessage(true)
      if (defaultMode === 'auto') {
        // Auto-fallback to GPS when Google Maps fails
        setTimeout(() => {
          setCurrentMode('gps')
          setShowFallbackMessage(false)
        }, 3000)
      }
    }
  }

  const switchToGPS = () => {
    setCurrentMode('gps')
    setShowFallbackMessage(false)
    setGoogleMapsError(null)
  }

  const switchToGoogleMaps = () => {
    setCurrentMode('google-maps')
    setGoogleMapsError(null)
  }

  return (
    <div className="space-y-6">
      {/* Calculator Mode Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Calculation Method</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={switchToGoogleMaps}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${ 
                currentMode === 'google-maps'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗺️ Google Maps
            </button>
            <button
              onClick={switchToGPS}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentMode === 'gps'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📡 GPS Based
            </button>
          </div>
        </div>

        {/* Method Description */}
        <div className="text-sm text-gray-600">
          {currentMode === 'google-maps' ? (
            <div className="flex items-start space-x-3">
              <span className="text-lg">🗺️</span>
              <div>
                <p className="font-medium text-gray-800 mb-1">Google Maps Routing</p>
                <p>Uses real-time traffic data and precise road networks for the most accurate route calculations.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-3">
              <span className="text-lg">📡</span>
              <div>
                <p className="font-medium text-gray-800 mb-1">GPS-Based Calculation</p>
                <p>Uses direct distance calculations between coordinates. Reliable when map services are unavailable.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fallback Message */}
      {showFallbackMessage && googleMapsError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h4 className="text-amber-800 font-semibold mb-2">Google Maps Service Issue</h4>
              <p className="text-amber-700 text-sm mb-3">
                {googleMapsError}
              </p>
              {defaultMode === 'auto' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-3 mb-3">
                  <p className="text-emerald-700 text-sm">
                    🔄 Automatically switching to GPS-based calculator in a few seconds...
                  </p>
                </div>
              )}
              <button
                onClick={switchToGPS}
                className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                📡 Switch to GPS Calculator Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Component */}
      <div className="transition-all duration-500 ease-in-out">
        {currentMode === 'google-maps' ? (
          <GoogleMapsFareCalculator onError={handleGoogleMapsError} />
        ) : (
          <SmartFareCalculator preferredMethod="gps" onError={handleGoogleMapsError} />
        )}
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-2xl">🗺️</span>
            <h4 className="font-semibold text-blue-800">Google Maps Method</h4>
          </div>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✓ Real-time traffic data</li>
            <li>✓ Precise road routing</li>
            <li>✓ Visual map display</li>
            <li>✓ Turn-by-turn directions</li>
          </ul>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-2xl">📡</span>
            <h4 className="font-semibold text-emerald-800">GPS-Based Method</h4>
          </div>
          <ul className="text-sm text-emerald-700 space-y-1">
            <li>✓ Works without internet</li>
            <li>✓ Direct distance calculation</li>
            <li>✓ Real-time position tracking</li>
            <li>✓ Battery efficient</li>
          </ul>
        </div>
      </div>
    </div>
  )
}