'use client'

import DriverDashboard from '@/components/DriverDashboard'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'

export default function DriverPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="Trip Session"
          subtitle="Manage one active trip with quick rider actions"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <DriverDashboard />
        </div>
      </div>
    </RoleGuard>
  )
}
