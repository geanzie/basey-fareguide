'use client'

import RoleGuard from '@/components/RoleGuard'
import AdminUserManagement from '@/components/AdminUserManagement'
import GradientHeader from '@/ui/GradientHeader'

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-6xl">
        <GradientHeader
          title="User Management"
          subtitle="Manage system users, registrations, and permissions"
          backHref="/admin"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <AdminUserManagement />
        </div>
      </div>
    </RoleGuard>
  )
}
