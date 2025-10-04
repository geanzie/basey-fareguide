'use client'

import RoleGuard from '@/components/RoleGuard'
import PublicUserDashboard from '@/components/PublicUserDashboard'

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <PublicUserDashboard />
    </RoleGuard>
  )
}