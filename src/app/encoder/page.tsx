'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitManagement from '@/components/PermitManagement'
import PermitStatistics from '@/components/PermitStatistics'

export default function EncoderPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <EncoderContent />
    </RoleGuard>
  )
}

function EncoderContent() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Encoder Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Manage driver and vehicle permits for Basey Municipality
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="space-y-8">
          <PermitStatistics />
          <PermitManagement />
        </div>
      </div>
    </div>
  )
}