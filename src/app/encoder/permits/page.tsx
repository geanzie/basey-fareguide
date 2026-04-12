'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import PageWrapper from '@/components/PageWrapper'

export default function PermitsListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PermitsListContent />
    </RoleGuard>
  )
}

function PermitsListContent() {
  return (
    <PageWrapper 
      title="All Permits"
      subtitle="Manage driver and vehicle permits with the full encoder action set"
    >
      <div className="space-y-8">
        <PermitStatistics />
        <PermitManagement />
      </div>
    </PageWrapper>
  )
}