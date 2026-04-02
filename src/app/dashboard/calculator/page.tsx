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
            Choose a quick estimate or an exact routed trip for travel within Basey Municipality.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
            <span className="font-medium">Routing:</span>
            <span>OpenRouteService first, GPS fallback only when road routing is unavailable.</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <RoutePlannerCalculator />
        </div>
      </div>
    </DashboardLayout>
  )
}
