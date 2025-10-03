'use client'

import DashboardLayout from '@/components/DashboardLayout'
import AuthorityDashboard from '@/components/AuthorityDashboard'
import PublicUserDashboard from '@/components/PublicUserDashboard'
import { useAuth } from '@/components/AuthProvider'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {user?.userType === 'PUBLIC' ? (
          <PublicUserDashboard />
        ) : (
          <AuthorityDashboard />
        )}
      </div>
    </DashboardLayout>
  )
}