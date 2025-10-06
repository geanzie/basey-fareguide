'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminUserManagement from '@/components/AdminUserManagement'
import PageWrapper from '@/components/PageWrapper'

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="Admin Dashboard"
        subtitle="System administration and user management"
      >
        <AdminUserManagement />
      </PageWrapper>
    </RoleGuard>
  )
}