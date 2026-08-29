'use client'

import Link from 'next/link'

import UserProfile from '@/components/UserProfile'
import ChangePasswordForm from '@/components/auth/ChangePasswordForm'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'
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
          <Card padded={false}>
            <Link
              href="/profile/about"
              className="flex items-center gap-4 p-4 transition hover:bg-slate-50"
            >
              <div className={`${getDashboardIconChipClasses('blue')} h-10 w-10 shrink-0`}>
                <DashboardIconSlot icon={DASHBOARD_ICONS.info} size={DASHBOARD_ICON_POLICY.sizes.card} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">About FareCheck</div>
                <p className="text-sm text-slate-600">
                  How fares work, municipal notices, and the governing ordinance
                </p>
              </div>
            </Link>
          </Card>
        </div>
      </PageShell>
    </RoleGuard>
  )
}
