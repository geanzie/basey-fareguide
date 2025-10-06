'use client'

import SmartFareCalculator from '@/components/SmartFareCalculator'

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
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
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-2xl shadow-lg">
            <span className="text-2xl mr-3">🧠</span>
            <div className="text-left">
              <div className="font-semibold">Smart Calculator</div>
              <div className="text-sm text-emerald-100">Google Maps + GPS • Auto-fallback • Always reliable</div>
            </div>
          </div>
        </div>

        {/* Calculator Component */}
        <div className="mb-12">
          <SmartFareCalculator preferredMethod="auto" />
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