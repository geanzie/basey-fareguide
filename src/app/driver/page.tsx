'use client'

import DriverDashboard from '@/components/DriverDashboard'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function DriverPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageWrapper
        title="Trip Session"
        subtitle="Manage one active trip for your assigned vehicle with quick rider actions"
      >
        <DriverDashboard />
      </PageWrapper>
    </RoleGuard>
  )
}