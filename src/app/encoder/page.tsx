'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'
import PageWrapper from '@/components/PageWrapper'
import Link from 'next/link'

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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/encoder/permits"
              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</div>
                <h3 className="font-semibold text-emerald-700">Manage Permits</h3>
                <p className="text-sm text-emerald-600 mt-1">View and manage all permits</p>
              </div>
            </Link>

            <Link
              href="/encoder/vehicles/new"
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🚗</div>
                <h3 className="font-semibold text-blue-700">Register Vehicle</h3>
                <p className="text-sm text-blue-600 mt-1">Add new vehicle to system</p>
              </div>
            </Link>

            <Link
              href="/encoder/vehicles"
              className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-4 transition-colors group"
            >
              <div className="text-center">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔍</div>
                <h3 className="font-semibold text-purple-700">Vehicle Registry</h3>
                <p className="text-sm text-purple-600 mt-1">Browse all vehicles</p>
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
