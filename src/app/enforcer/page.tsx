'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageShell from '@/ui/PageShell'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageShell
        title="Incident Operations"
        subtitle="Review incidents, manage evidence, and complete resolution work"
      >
        <EnforcerIncidentsList mode="dashboard" />
      </PageShell>
    </RoleGuard>
  )
}
