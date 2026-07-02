'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import GradientHeader from '@/ui/GradientHeader'

export default function EnforcerIncidentsPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Incident Queue"
          subtitle="Work unresolved incidents in priority order using the shared incident workflow"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <EnforcerIncidentsList mode="queue" />
        </div>
      </div>
    </RoleGuard>
  )
}
