'use client'

import RoleGuard from '@/components/RoleGuard'
import EnforcerIncidentsList from '@/components/EnforcerIncidentsList'
import GradientHeader from '@/ui/GradientHeader'

export default function EnforcerPage() {
  return (
    <RoleGuard allowedRoles={['ENFORCER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Incident Operations"
          subtitle="Review incidents, manage evidence, and complete resolution work"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <EnforcerIncidentsList mode="dashboard" />
        </div>
      </div>
    </RoleGuard>
  )
}
