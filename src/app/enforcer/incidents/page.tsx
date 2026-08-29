'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageShell from '@/ui/PageShell'

export default function EnforcerIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageShell
        title="Incident Queue"
        subtitle="Work unresolved incidents in priority order using the shared incident workflow"
      >
        <EnforcerIncidentsList mode="queue" />
      </PageShell>
    </RoleGuard>
  )
}
