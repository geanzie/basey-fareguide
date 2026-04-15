'use client'

import DriverDashboard from '@/components/DriverDashboard'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'

export default function DriverPage() {
  return (
    <RoleGuard allowedRoles={['DRIVER']}>
      <PageWrapper
        title="Driver Portal"
        subtitle="Read-only access to your assigned vehicle identity, compliance status, and account details"
      >
        <DriverDashboard />
      </PageWrapper>
    </RoleGuard>
  )
}