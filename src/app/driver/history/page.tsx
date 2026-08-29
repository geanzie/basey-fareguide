'use client'

import DriverTripHistory from '@/components/DriverTripHistory'
import RoleGuard from '@/components/RoleGuard'
import PageShell from '@/ui/PageShell'

export default function DriverHistoryPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageShell
        title="Trip History"
        subtitle="Review closed trips and rider snapshots"
        width="narrow"
      >
        <DriverTripHistory showHeader={false} />
      </PageShell>
    </RoleGuard>
  )
}
