'use client'

import { useState } from 'react'
import Link from 'next/link'
import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'
import TripTrackerCalculator from '@/components/TripTrackerCalculator'

type CalculatorMode = 'selection' | 'planner' | 'tracker'

export default function CalculatorPage() {
  const [mode, setMode] = useState<CalculatorMode>('selection')

  if (mode === 'planner') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => setMode('selection')}
            className="mb-6 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="mr-2">←</span>
            Back to Calculator Selection
          </button>
          
          <RoutePlannerCalculator />
        </div>
      </div>
    )
  }

  if (mode === 'tracker') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => setMode('selection')}
            className="mb-6 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="mr-2">←</span>
            Back to Calculator Selection
          </button>
          
          <TripTrackerCalculator />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Basey Fare Calculator
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the right calculator for your needs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">🗺️</span>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Route Planner</h2>
              <p className="text-gray-600">Plan your trip in advance</p>
            </div>
            
            <ul className="space-y-2 text-gray-600 mb-6">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Select locations from dropdown
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Google Maps routing
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Instant fare calculation
              </li>
            </ul>
            
            <button
              onClick={() => setMode('planner')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg"
            >
              Start Planning
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center mb-6">
              <span className="text-4xl mb-4 block">📍</span>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Trip Tracker</h2>
              <p className="text-gray-600">Track your journey in real-time</p>
            </div>
            
            <ul className="space-y-2 text-gray-600 mb-6">
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Real-time GPS tracking
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Live fare updates
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-2">✓</span>
                Most accurate results
              </li>
            </ul>
            
            <button
              onClick={() => setMode('tracker')}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg"
            >
              Start Tracking
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
