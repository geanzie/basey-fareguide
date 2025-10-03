'use client'

import DashboardLayout from '@/components/DashboardLayout'
import IncidentReporting from '@/components/IncidentReporting'

export default function ReportPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Incident</h1>
          <p className="text-gray-600">
            Report transportation violations and incidents in Basey Municipality
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <IncidentReporting />
        </div>
      </div>
    </DashboardLayout>
  )
}