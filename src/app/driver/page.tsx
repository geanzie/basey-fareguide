'use client'

import DriverDashboard from '@/components/DriverDashboard'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function DriverPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageShell
        title="Trip Session"
        subtitle="Manage one active trip with quick rider actions"
      >
        <DriverDashboard />
      </PageShell>
    </RoleGuard>
  )
}
