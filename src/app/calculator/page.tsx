'use client'

import { useState } from 'react'
import FareCalculator from '@/components/FareCalculator'
import GoogleMapsFareCalculator from '@/components/GoogleMapsFareCalculator'

export default function CalculatorPage() {
  const [selectedCalculator, setSelectedCalculator] = useState<'basic' | 'google'>('basic')

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Basey Fare Calculator
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Choose between our enhanced local algorithm or GPS-accurate Google Maps routing 
            for precise fare calculations across Basey Municipality.
          </p>
          
          {/* Calculator Type Selector */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => setSelectedCalculator('basic')}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                selectedCalculator === 'basic'
                  ? 'bg-emerald-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-emerald-600 border-2 border-emerald-200 hover:border-emerald-300'
              }`}
            >
              <span className="mr-2">🗺️</span>
              Enhanced Local Calculator
            </button>
            <button
              onClick={() => setSelectedCalculator('google')}
              className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
                selectedCalculator === 'google'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-300'
              }`}
            >
              <span className="mr-2">🛰️</span>
              Google Maps Calculator
            </button>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 ${
            selectedCalculator === 'basic' ? 'border-emerald-300 ring-4 ring-emerald-100' : 'border-gray-200'
          }`}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
                <span className="text-2xl">🗺️</span>
              </div>
              <h3 className="text-xl font-bold text-emerald-700">Enhanced Local Calculator</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-700">
                <span className="text-emerald-500 mr-3">✓</span>
                <span>Calibrated to local road networks</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-emerald-500 mr-3">✓</span>
                <span>85-95% accuracy for Basey routes</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-emerald-500 mr-3">✓</span>
                <span>Works offline</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-emerald-500 mr-3">✓</span>
                <span>Fast calculation</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-emerald-500 mr-3">✓</span>
                <span>Terrain-aware routing</span>
              </li>
            </ul>
          </div>

          <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 ${
            selectedCalculator === 'google' ? 'border-blue-300 ring-4 ring-blue-100' : 'border-gray-200'
          }`}>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                <span className="text-2xl">🛰️</span>
              </div>
              <h3 className="text-xl font-bold text-blue-700">Google Maps Calculator</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-700">
                <span className="text-blue-500 mr-3">✓</span>
                <span>GPS-accurate routing</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-blue-500 mr-3">✓</span>
                <span>Real-time traffic data</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-blue-500 mr-3">✓</span>
                <span>Visual route display</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-blue-500 mr-3">✓</span>
                <span>Precise travel time</span>
              </li>
              <li className="flex items-center text-gray-700">
                <span className="text-blue-500 mr-3">✓</span>
                <span>Always up-to-date</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Calculator Component */}
        <div className="mb-12">
          {selectedCalculator === 'basic' && <FareCalculator />}
          {selectedCalculator === 'google' && <GoogleMapsFareCalculator />}
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
              <div className="text-2xl font-bold text-emerald-600 mb-2">₱15.00</div>
              <div className="text-sm text-gray-600">Base Fare</div>
              <div className="text-xs text-gray-500 mt-1">First 3 kilometers</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-emerald-600 mb-2">₱3.00</div>
              <div className="text-sm text-gray-600">Additional Rate</div>
              <div className="text-xs text-gray-500 mt-1">Per kilometer after 3km</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="text-2xl font-bold text-emerald-600 mb-2">51</div>
              <div className="text-sm text-gray-600">Barangays</div>
              <div className="text-xs text-gray-500 mt-1">Complete coverage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}