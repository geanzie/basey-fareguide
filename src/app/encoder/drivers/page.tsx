'use client'

import RoleGuard from '@/components/RoleGuard'
import DriversList from '@/components/DriversList'
import PageWrapper from '@/components/PageWrapper'

export default function DriversPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PageWrapper 
        title="Driver Registry"
        subtitle="View and manage all registered drivers in the system"
      >
        <DriversList />
      </PageWrapper>
    </RoleGuard>
  )
}