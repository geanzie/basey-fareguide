'use client'

import DashboardLayout from '@/components/DashboardLayout'
import AuthorityDashboard from '@/components/AuthorityDashboardSimple'
import PublicUserDashboard from '@/components/PublicUserDashboard'
import { useAuth } from '@/components/AuthProvider'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <>
      {user?.userType === 'PUBLIC' ? (
        <PublicUserDashboard />
      ) : (
        <AuthorityDashboard />
      )}
    </>
  )
}