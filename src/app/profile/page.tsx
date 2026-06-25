'use client'

import UserProfile from '@/components/UserProfile'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
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
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="app-surface-card rounded-2xl">
            <UserProfile />
          </div>
          <div className="app-surface-card rounded-2xl">
            <ChangePasswordForm />
          </div>
        </div>
      </PageWrapper>
    </RoleGuard>
  )
}
