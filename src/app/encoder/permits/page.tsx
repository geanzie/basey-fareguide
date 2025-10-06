'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitsList from '@/components/PermitsList'
import PageWrapper from '@/components/PageWrapper'

export default function PermitsListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PermitsListContent />
    </RoleGuard>
  )
}

function PermitsListContent() {
  return (
    <PageWrapper 
      title="All Permits"
      subtitle="Browse and manage all driver and vehicle permits"
    >
      <PermitsList />
    </PageWrapper>
  )
}