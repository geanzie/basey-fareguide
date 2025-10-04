'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <EnforcerContent />
    </RoleGuard>
  )
}

function EnforcerContent() {
  return (
    <main className="flex-1">
      <EnforcerIncidentsList />
    </main>
  )
}