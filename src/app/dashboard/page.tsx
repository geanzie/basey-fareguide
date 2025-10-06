'use client'

import RoleGuard from '@/components/RoleGuard'
import PublicUserDashboard from '@/components/PublicUserDashboard'
import PageWrapper from '@/components/PageWrapper'

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper 
        title="My Dashboard"
        subtitle="Track your fare calculations and incident reports"
      >
        <PublicUserDashboard />
      </PageWrapper>
    </RoleGuard>
  )
}