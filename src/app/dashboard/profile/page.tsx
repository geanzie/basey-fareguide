'use client'

import DashboardLayout from '@/components/DashboardLayout'
import UserProfile from '@/components/UserProfile'
import { useAuth } from '@/components/AuthProvider'

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">
            Manage your account information and preferences
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          {user && <UserProfile user={user} />}
        </div>
      </div>
    </DashboardLayout>
  )
}