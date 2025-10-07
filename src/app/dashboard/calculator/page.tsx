'use client'

import DashboardLayout from '@/components/DashboardLayout'
import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'

export default function CalculatorPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Fare Calculator</h1>
          <p className="text-gray-600">
            Calculate accurate transportation fares using GPS-accurate Google Maps routing for routes within Basey Municipality
          </p>
          
          {/* Google Maps Badge */}
          <div className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-blue-600 mr-2">🛰️</span>
            <span className="text-sm font-medium text-blue-700">Powered by Google Maps API</span>
            <span className="ml-2 text-xs text-blue-600">Real-time • GPS-accurate</span>
          </div>
        </div>
        
        {/* Calculator Component */}
        <div className="bg-white rounded-lg shadow-sm border">
          <RoutePlannerCalculator />
        </div>
      </div>
    </DashboardLayout>
  )
}