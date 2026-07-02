'use client'

import DriverIncidentsList from '@/components/DriverIncidentsList'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'

export default function DriverIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="Vehicle Incidents"
          subtitle="Incidents reported against your currently assigned vehicle"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <DriverIncidentsList />
        </div>
      </div>
    </RoleGuard>
  )
}
