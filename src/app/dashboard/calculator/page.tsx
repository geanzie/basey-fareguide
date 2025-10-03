'use client'

import DashboardLayout from '@/components/DashboardLayout'
import FareCalculator from '@/components/FareCalculator'

export default function CalculatorPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Fare Calculator</h1>
          <p className="text-gray-600">
            Calculate accurate transportation fares for routes within Basey Municipality
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <FareCalculator />
        </div>
      </div>
    </DashboardLayout>
  )
}