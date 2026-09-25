'use client'

import RoleGuard from '@/components/RoleGuard'
import { useAuth } from '@/components/AuthProvider'
import RiderControlCenter from '@/components/rider-operations/RiderControlCenter'

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['PUBLIC']}>
      <DashboardContent />
    </RoleGuard>
  )
}

function DashboardContent() {
  const { user } = useAuth()

  return (
    <RiderControlCenter
      title={user ? `Hello, ${user.firstName}` : 'My Dashboard'}
      subtitle="Your trips, fares and reports, and how Basey handles reports"
    />
  )
}
