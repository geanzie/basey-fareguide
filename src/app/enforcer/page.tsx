'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageWrapper from '@/components/PageWrapper'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageWrapper
        title="Incident Operations"
        subtitle="Review the shared incident list, manage evidence, and complete incident resolution work"
      >
        <EnforcerIncidentsList mode="dashboard" />
      </PageWrapper>
    </RoleGuard>
  )
}
