'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminUserManagement from '@/components/AdminUserManagement'
import PageWrapper from '@/components/PageWrapper'

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageWrapper 
        title="User Management"
        subtitle="Manage system users, registrations, and permissions"
      >
        <AdminUserManagement />
      </PageWrapper>
    </RoleGuard>
  )
}