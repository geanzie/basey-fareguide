'use client'

import UserProfile from '@/components/UserProfile'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
import RoleGuard from '@/components/RoleGuard'
import Card from '@/ui/Card'
import PageShell from '@/ui/PageShell'
import { AUTHENTICATED_ROLES } from '@/lib/authRoutes'

export default function ProfilePage() {
  return (
    <RoleGuard allowedRoles={AUTHENTICATED_ROLES}>
      <PageShell
        title="My Profile"
        subtitle="Manage your account information and preferences"
        width="narrow"
      >
        <div className="space-y-4">
          <UserProfile />
          <Card padded={false}>
            <ChangePasswordForm />
          </Card>
        </div>
      </PageShell>
    </RoleGuard>
  )
}
