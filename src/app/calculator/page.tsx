'use client'

import { useState } from 'react'
import SmartFareCalculator from '@/components/SmartFareCalculator'

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

export default function CalculatorPage() {
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)

  const handleRouteCalculated = (result: RouteResult, usedFallback: boolean = false) => {
    setRouteResult(result)
    setFallbackUsed(usedFallback)
  }

  const handleClearResult = () => {
    setRouteResult(null)
    setFallbackUsed(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-slate-50">
      <div className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Basey Fare Calculator
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Intelligent fare calculation with multiple methods: Google Maps routing with GPS fallback for reliable service.
          </p>
          
          {/* Smart Calculator Features Highlight */}
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-slate-600 to-blue-600 text-white rounded-2xl shadow-lg">
            <span className="text-2xl mr-3">🧠</span>
            <div className="text-left">
              <div className="font-semibold">Smart Calculator</div>
              <div className="text-sm text-slate-100">Google Maps + GPS • Auto-fallback • Always reliable</div>
            </div>
          </div>
        </div>

        {/* PROMINENT ROUTE RESULT - Displayed at top when available */}
        {routeResult && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-slate-600 to-blue-700 text-white rounded-2xl shadow-xl p-8 border-2 border-slate-300">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center">
                  <span className="text-4xl mr-4">🎯</span>
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Your Fare Calculation</h2>
                    <p className="text-green-100 text-lg">Trip details and cost breakdown</p>
                  </div>
                </div>
                <button
                  onClick={handleClearResult}
                  className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Calculate New Route
                </button>
              </div>

              {fallbackUsed && (
                <div className="bg-yellow-400/20 border border-yellow-300/50 rounded-lg p-3 mb-6">
                  <p className="text-yellow-100 text-sm flex items-center">
                    <span className="mr-2">ℹ️</span>
                    Google Maps unavailable - using GPS calculation as fallback
                  </p>
                </div>
              )}

              {/* Main Fare Display */}
              <div className="text-center mb-8">
                <div className="text-6xl font-bold mb-2 text-white drop-shadow-lg">
                  ₱{routeResult.fare.fare.toFixed(2)}
                </div>
                <div className="text-xl text-slate-100">Total Fare</div>
              </div>

              {/* Trip Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {routeResult.distance.text}
                  </div>
                  <div className="text-slate-100">Distance</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-white mb-1">
                    {routeResult.duration.text}
                  </div>
                  <div className="text-slate-100">Duration</div>
                </div>
              </div>

              {/* Fare Breakdown */}
              <div className="bg-white/10 rounded-xl p-6">
                <h4 className="font-semibold text-white mb-4 text-lg">Fare Breakdown</h4>
                <div className="space-y-3 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-100">Base fare (first 3km):</span>
                    <span className="font-semibold text-lg">₱{routeResult.fare.breakdown.baseFare.toFixed(2)}</span>
                  </div>
                  {routeResult.fare.breakdown.additionalDistance > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-100">
                        Additional distance ({routeResult.fare.breakdown.additionalDistance.toFixed(1)}km @ ₱3/km):
                      </span>
                      <span className="font-semibold text-lg">₱{routeResult.fare.breakdown.additionalFare.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/30 pt-3 flex justify-between items-center">
                    <span className="font-bold text-lg">Total:</span>
                    <span className="font-bold text-2xl">₱{routeResult.fare.fare.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Method Info */}
              <div className="text-center text-slate-100 text-sm mt-4">
                Calculated using: {routeResult.source} • Accuracy: {routeResult.accuracy}
              </div>
            </div>
          </div>
        )}

        {/* Calculator Component */}
        <div className="mb-12">
          <SmartFareCalculator 
            preferredMethod="auto" 
            onRouteCalculated={handleRouteCalculated}
            hideResults={!!routeResult}
          />
        </div>

        {/* Information Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              About Basey Municipality Fare System
            </h3>
            <p className="text-gray-600">
              Official fare structure based on Municipal Ordinance 105 Series of 2023
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600 mb-2">₱15.00</div>
              <div className="text-sm text-gray-600">Base Fare</div>
              <div className="text-xs text-gray-500 mt-1">First 3 kilometers</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600 mb-2">₱3.00</div>
              <div className="text-sm text-gray-600">Additional Rate</div>
              <div className="text-xs text-gray-500 mt-1">Per kilometer after 3km</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600 mb-2">51</div>
              <div className="text-sm text-gray-600">Barangays</div>
              <div className="text-xs text-gray-500 mt-1">Complete coverage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}