'use client'

import DriverIncidentsList from '@/components/DriverIncidentsList'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function DriverIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageShell
        title="Vehicle Incidents"
        subtitle="Incidents reported against your currently assigned vehicle"
        width="narrow"
      >
        <DriverIncidentsList />
      </PageShell>
    </RoleGuard>
  )
}
