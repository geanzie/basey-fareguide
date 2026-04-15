'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageWrapper from '@/components/PageWrapper'

export default function EnforcerIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageWrapper 
        title="Incident Queue"
        subtitle="Work unresolved incidents in priority order using the shared incident workflow"
      >
        <EnforcerIncidentsList mode="queue" />
      </PageWrapper>
    </RoleGuard>
  )
}