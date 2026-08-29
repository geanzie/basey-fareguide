'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminUserManagement from '@/components/AdminUserManagement'
import PageShell from '@/ui/PageShell'

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <PageShell
        title="User Management"
        subtitle="Manage system users, registrations, and permissions"
        backHref="/admin"
      >
        <AdminUserManagement />
      </PageShell>
    </RoleGuard>
  )
}
