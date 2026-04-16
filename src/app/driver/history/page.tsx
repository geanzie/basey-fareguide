'use client'

import DriverTripHistory from '@/components/DriverTripHistory'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function DriverHistoryPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageWrapper
        title="Trip History"
        subtitle="Review closed trips and rider snapshots without leaving driver workspace"
      >
        <DriverTripHistory showHeader={false} />
      </PageWrapper>
    </RoleGuard>
  )
}