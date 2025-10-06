'use client'

import RoleGuard from '@/components/RoleGuard'
import UserHistory from '@/components/UserHistory'
import PageWrapper from '@/components/PageWrapper'

export default function HistoryPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PageWrapper 
        title="My History"
        subtitle="View all your fare calculations and incident reports"
      >
        <UserHistory />
      </PageWrapper>
    </RoleGuard>
  )
}