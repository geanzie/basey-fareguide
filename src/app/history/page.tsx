'use client'

import { Suspense } from 'react'
import RoleGuard from '@/components/RoleGuard'
import UserHistory from '@/components/UserHistory'
import PageShell from '@/ui/PageShell'
import { ListSkeleton } from '@/ui/Skeleton'

export default function HistoryPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageShell
        title="My History"
        subtitle="View all your fare calculations and incident reports"
        width="narrow"
      >
        <Suspense fallback={<ListSkeleton count={4} />}>
          <UserHistory />
        </Suspense>
      </PageShell>
    </RoleGuard>
  )
}
