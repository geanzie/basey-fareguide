'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import PageShell from '@/ui/PageShell'

export default function PermitsListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageShell
        title="All Permits"
        subtitle="Manage driver and vehicle permits with the full encoder action set"
      >
        <div className="space-y-6">
          <PermitStatistics />
          <PermitManagement />
        </div>
      </PageShell>
    </RoleGuard>
  )
}
