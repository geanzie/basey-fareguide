'use client'

import { Suspense } from 'react'
import RoleGuard from '@/components/RoleGuard'
import UserHistory from '@/components/UserHistory'
import GradientHeader from '@/ui/GradientHeader'
import { ListSkeleton } from '@/ui/Skeleton'

export default function HistoryPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="My History"
          subtitle="View all your fare calculations and incident reports"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <Suspense fallback={<ListSkeleton count={4} />}>
            <UserHistory />
          </Suspense>
        </div>
      </div>
    </RoleGuard>
  )
}
