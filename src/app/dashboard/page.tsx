'use client'

import dynamic from 'next/dynamic'
import RoleGuard from '@/components/RoleGuard'
import { useAuth } from '@/components/AuthProvider'
import PageShell from '@/ui/PageShell'
import { SectionSkeleton } from '@/ui/Skeleton'

const PublicUserDashboard = dynamic(() => import('@/components/PublicUserDashboard'), {
  loading: () => (
    <div className="p-4">
      <SectionSkeleton />
    </div>
  ),
})

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageShell
        title={user ? `Hello, ${user.firstName}` : 'My Dashboard'}
        subtitle="Track your fare calculations and incident reports"
      >
        <PublicUserDashboard />
      </PageShell>
    </RoleGuard>
  )
}
