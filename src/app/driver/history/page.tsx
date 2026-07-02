'use client'

import DriverTripHistory from '@/components/DriverTripHistory'
import RoleGuard from '@/components/RoleGuard'
import GradientHeader from '@/ui/GradientHeader'

export default function DriverHistoryPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="Trip History"
          subtitle="Review closed trips and rider snapshots"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <DriverTripHistory showHeader={false} />
        </div>
      </div>
    </RoleGuard>
  )
}
