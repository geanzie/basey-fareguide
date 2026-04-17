'use client'

import DriverIncidentsList from '@/components/DriverIncidentsList'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function DriverIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageWrapper
        title="Vehicle Incidents"
        subtitle="Incidents reported against your currently assigned vehicle"
      >
        <DriverIncidentsList />
      </PageWrapper>
    </RoleGuard>
  )
}
