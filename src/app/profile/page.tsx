'use client'

import UserProfile from '@/components/UserProfile'
import PageWrapper from '@/components/PageWrapper'
import RoleGuard from '@/components/RoleGuard'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'

export default function ProfilePage() {
  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <PageWrapper
        title="My Profile"
        subtitle="Manage your account information and preferences"
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border">
            <UserProfile />
          </div>
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}
