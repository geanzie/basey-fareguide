'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import GradientHeader from '@/ui/GradientHeader'

export default function PermitsListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="All Permits"
          subtitle="Manage driver and vehicle permits with the full encoder action set"
          compact
        />
        <div className="-mt-6 space-y-6 px-4 pb-8 lg:px-8">
          <PermitStatistics />
          <PermitManagement />
        </div>
      </div>
    </RoleGuard>
  )
}
