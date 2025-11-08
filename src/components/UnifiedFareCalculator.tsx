'use client'

import { useState, useEffect } from 'react'
import RoutePlannerCalculator from './RoutePlannerCalculator'
import SmartFareCalculator from './SmartFareCalculator'
import { barangayService } from '../lib/barangayService'
import { BarangayInfo } from '../utils/barangayBoundaries'

interface UnifiedCalculatorProps {
  defaultMode?: 'google-maps' | 'gps' | 'auto'
}

export default function UnifiedFareCalculator({ defaultMode = 'auto' }: UnifiedCalculatorProps) {
  const [currentMode, setCurrentMode] = useState<'google-maps' | 'gps'>('google-maps')
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null)
  const [showFallbackMessage, setShowFallbackMessage] = useState(false)
  const [barangayStats, setBarangayStats] = useState<{
    totalBarangays: number;
    poblacionCount: number;
    ruralCount: number;
  } | null>(null)

  useEffect(() => {
    if (defaultMode === 'gps') {
      setCurrentMode('gps')
    } else if (defaultMode === 'google-maps') {
      setCurrentMode('google-maps')
    }

    // Initialize barangay service and get stats
    const initializeBarangayData = async () => {
      try {
        await barangayService.initialize()
        const allBarangays = barangayService.getBarangays()
        const poblacionBarangays = barangayService.getBarangays({ poblacionOnly: true })
        
        setBarangayStats({
          totalBarangays: allBarangays.length,
          poblacionCount: poblacionBarangays.length,
          ruralCount: allBarangays.length - poblacionBarangays.length
        })
      } catch (error) {}
    }

    initializeBarangayData()
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
                <p className="font-medium text-gray-800 mb-1">Google Maps Routing with Barangay Boundaries</p>
                <p>Uses real-time traffic data, precise road networks, and local barangay boundary analysis for enhanced fare calculations.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start space-x-3">
              <span className="text-lg">📡</span>
              <div>
                <p className="font-medium text-gray-800 mb-1">GPS-Based with Geographic Intelligence</p>
                <p>Uses direct distance calculations with barangay boundary detection. Enhanced with local geographic data for accurate fare computation.</p>
              </div>
            </div>
          )}
        </div>

        {/* Barangay Coverage Stats */}
        {barangayStats && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">🗺️</span>
              <h4 className="font-medium text-gray-800">Geographic Coverage</h4>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{barangayStats.totalBarangays}</div>
                <div className="text-gray-600">Total Barangays</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-600">{barangayStats.poblacionCount}</div>
                <div className="text-gray-600">Poblacion Areas</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-orange-600">{barangayStats.ruralCount}</div>
                <div className="text-gray-600">Rural Areas</div>
              </div>
            </div>
          </div>
        )}
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
          <RoutePlannerCalculator onError={handleGoogleMapsError} />
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
            <li>✓ Barangay boundary detection</li>
            <li>✓ Visual map with boundaries</li>
            <li>✓ Cross-boundary fare adjustments</li>
          </ul>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-2xl">📡</span>
            <h4 className="font-semibold text-emerald-800">GPS-Based Method</h4>
          </div>
          <ul className="text-sm text-emerald-700 space-y-1">
            <li>✓ Works without internet</li>
            <li>✓ Geographic boundary analysis</li>
            <li>✓ Point-in-polygon detection</li>
            <li>✓ Poblacion/rural rate detection</li>
            <li>✓ Battery efficient</li>
          </ul>
        </div>
      </div>
    </div>
  )
}