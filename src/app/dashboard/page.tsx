'use client'

import RoleGuard from '@/components/RoleGuard'
import dynamic from 'next/dynamic'
import PageWrapper from '@/components/PageWrapper'

const PublicUserDashboard = dynamic(() => import('@/components/PublicUserDashboard'), {
  loading: () => <div className="p-6">Loading your dashboard...</div>
})

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