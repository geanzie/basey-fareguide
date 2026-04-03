'use client'

import DashboardLayout from '@/components/DashboardLayout'
import RoutePlannerCalculator from '@/components/RoutePlannerCalculator'

export default function CalculatorPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border">
          <RoutePlannerCalculator />
        </div>
      </div>
    </DashboardLayout>
  )
}
