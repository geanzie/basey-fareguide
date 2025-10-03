'use client'

import DashboardLayout from '@/components/DashboardLayout'
import IncidentsList from '@/components/IncidentsList'

export default function IncidentsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Incidents</h1>
          <p className="text-gray-600">
            View and manage reported transportation incidents and violations
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <IncidentsList />
        </div>
      </div>
    </DashboardLayout>
  )
}