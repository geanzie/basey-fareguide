'use client'

import UserProfile from '@/components/UserProfile'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
import RoleGuard from '@/components/RoleGuard'
import Card from '@/ui/Card'
import GradientHeader from '@/ui/GradientHeader'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'

export default function ProfilePage() {
  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <div className="mx-auto max-w-4xl">
        <GradientHeader
          title="My Profile"
          subtitle="Manage your account information and preferences"
          compact
        />
        <div className="-mt-6 space-y-4 px-4 pb-8 lg:px-8">
          <UserProfile />
          <Card padded={false}>
            <ChangePasswordForm />
          </Card>
        </div>
      </div>
    </RoleGuard>
  )
}
