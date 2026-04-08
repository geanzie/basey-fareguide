'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import PageWrapper from '@/components/PageWrapper'
import Link from 'next/link'
import {
  DASHBOARD_ICONS,
  DASHBOARD_ICON_POLICY,
  DashboardIconSlot,
  getDashboardIconChipClasses,
} from '@/components/dashboardIcons'

export default function EncoderPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <EncoderContent />
    </RoleGuard>
  )
}

function EncoderContent() {
  return (
    <PageWrapper 
      title="Data Encoder Dashboard"
      subtitle="Manage vehicle permits for Basey Municipality"
    >
      <div className="space-y-8">
        {/* Quick Actions */}
        <div className="app-surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/encoder/permits"
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className={`${getDashboardIconChipClasses('emerald')} group-hover:scale-110 transition-transform`}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.fileText} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                  </div>
                </div>
                <h3 className="font-semibold text-emerald-700">Manage Permits</h3>
                <p className="text-sm text-emerald-600 mt-1">View and manage all permits</p>
              </div>
            </Link>

            <Link
              href="/encoder/vehicles/new"
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className={`${getDashboardIconChipClasses('blue')} group-hover:scale-110 transition-transform`}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.vehicle} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                  </div>
                </div>
                <h3 className="font-semibold text-blue-700">Register Vehicle</h3>
                <p className="text-sm text-blue-600 mt-1">Add new vehicle to system</p>
              </div>
            </Link>

            <Link
              href="/encoder/vehicles"
              className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className={`${getDashboardIconChipClasses('purple')} group-hover:scale-110 transition-transform`}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.inspect} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                  </div>
                </div>
                <h3 className="font-semibold text-purple-700">Vehicle Registry</h3>
                <p className="text-sm text-purple-600 mt-1">Browse all vehicles</p>
              </div>
            </Link>

            <Link
              href="/encoder/ticket-payments"
              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="mb-3 flex justify-center">
                  <div className={`${getDashboardIconChipClasses('amber')} group-hover:scale-110 transition-transform`}>
                    <DashboardIconSlot icon={DASHBOARD_ICONS.ticket} size={DASHBOARD_ICON_POLICY.sizes.hero} />
                  </div>
                </div>
                <h3 className="font-semibold text-amber-700">Ticket Payments</h3>
                <p className="text-sm text-amber-600 mt-1">Record settlements and receipt notes</p>
              </div>
            </Link>
          </div>
        </div>

        <PermitStatistics />
        <PermitManagement />
      </div>
    </PageWrapper>
  )
}
