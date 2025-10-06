'use client'

import { useAuth } from '@/components/AuthProvider'
import UserProfile from '@/components/UserProfile'
import PageWrapper from '@/components/PageWrapper'

export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <PageWrapper
        title="Profile"
        subtitle="Please log in to view your profile"
      >
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600">
              Please log in to access your profile
            </p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="My Profile"
      subtitle="Manage your account information and preferences"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border">
          <UserProfile user={user} />
        </div>
      </div>
    </PageWrapper>
  )
}