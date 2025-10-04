'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import FareCalculator from '@/components/FareCalculator'
import GoogleMapsFareCalculator from '@/components/GoogleMapsFareCalculator'

export default function CalculatorPage() {
  const [selectedCalculator, setSelectedCalculator] = useState<'enhanced' | 'googlemaps'>('googlemaps')

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Fare Calculator</h1>
          <p className="text-gray-600">
            Calculate accurate transportation fares for routes within Basey Municipality
          </p>
        </div>

        {/* Calculator Selection */}
        <div className="mb-6">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Choose Calculator Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedCalculator('googlemaps')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedCalculator === 'googlemaps'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">🌐</span>
                  <div>
                    <h4 className="font-bold text-gray-900">Google Maps Calculator</h4>
                    <p className="text-sm text-gray-600">Most accurate with real-time data</p>
                  </div>
                </div>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Real road distances and traffic data</li>
                  <li>• Accurate travel time estimates</li>
                  <li>• Current road conditions</li>
                  <li>• Requires internet connection</li>
                </ul>
              </button>

              <button
                onClick={() => setSelectedCalculator('enhanced')}
                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedCalculator === 'enhanced'
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">🗺️</span>
                  <div>
                    <h4 className="font-bold text-gray-900">Enhanced Algorithm</h4>
                    <p className="text-sm text-gray-600">Local algorithm, works offline</p>
                  </div>
                </div>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Calibrated to Basey road conditions</li>
                  <li>• Works without internet</li>
                  <li>• 85-95% accuracy</li>
                  <li>• Instant calculations</li>
                </ul>
              </button>
            </div>
          </div>
        </div>
        
        {/* Calculator Component */}
        <div className="bg-white rounded-lg shadow-sm border">
          {selectedCalculator === 'googlemaps' ? (
            <GoogleMapsFareCalculator />
          ) : (
            <FareCalculator />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}