'use client'

import dynamic from 'next/dynamic'
import RoleGuard from '@/components/RoleGuard'
import { useAuth } from '@/components/AuthProvider'
import GradientHeader from '@/ui/GradientHeader'
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
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title={user ? `Hello, ${user.firstName}` : 'My Dashboard'}
          subtitle="Track your fare calculations and incident reports"
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <PublicUserDashboard />
        </div>
      </div>
    </RoleGuard>
  )
}
