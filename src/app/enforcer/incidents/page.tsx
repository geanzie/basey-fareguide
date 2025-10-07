'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageWrapper from '@/components/PageWrapper'

export default function EnforcerIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageWrapper 
        title="Incident Queue"
        subtitle="Respond to and manage traffic violations in priority order"
      >
        <EnforcerIncidentsList />
      </PageWrapper>
    </RoleGuard>
  )
}