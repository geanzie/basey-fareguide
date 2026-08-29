'use client'

import Link from 'next/link'

import { useAuth } from '@/components/AuthProvider'
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
  const { user } = useAuth()
  // History and Report sit in the desktop sidebar, but off the mobile tab bar —
  // this is where a public rider gets to them.
  const isPublic = user?.userType === 'PUBLIC'

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
          {isPublic ? (
            <>
              <Card padded={false}>
                <Link
                  href="/history"
                  className="flex items-center gap-4 p-4 transition hover:bg-slate-50"
                >
                  <div className={`${getDashboardIconChipClasses('emerald')} h-10 w-10 shrink-0`}>
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.history}
                      size={DASHBOARD_ICON_POLICY.sizes.card}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">My History</div>
                    <p className="text-sm text-slate-600">
                      Your past fare checks and the incident reports you filed
                    </p>
                  </div>
                </Link>
              </Card>
              <Card padded={false}>
                <Link
                  href="/report"
                  className="flex items-center gap-4 p-4 transition hover:bg-slate-50"
                >
                  <div className={`${getDashboardIconChipClasses('amber')} h-10 w-10 shrink-0`}>
                    <DashboardIconSlot
                      icon={DASHBOARD_ICONS.incidents}
                      size={DASHBOARD_ICON_POLICY.sizes.card}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">Report Incident</div>
                    <p className="text-sm text-slate-600">
                      Report an overcharge, refused ride, or driver misconduct
                    </p>
                  </div>
                </Link>
              </Card>
            </>
          ) : null}
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
