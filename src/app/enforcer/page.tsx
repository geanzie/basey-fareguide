'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import PageWrapper from '@/components/PageWrapper'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <PageWrapper
        title="Traffic Enforcement Center"
        subtitle="Queue, evidence, and resolution work for the active enforcement team"
      >
        <EnforcerIncidentsList />
      </PageWrapper>
    </RoleGuard>
  )
}
