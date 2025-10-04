'use client'

import RoleGuard from '@/components/RoleGuard'
import PermitsList from '@/components/PermitsList'

export default function PermitsListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <PermitsListContent />
    </RoleGuard>
  )
}

function PermitsListContent() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                All Permits
              </h1>
              <p className="text-gray-600 mt-1">
                Browse and manage all driver and vehicle permits
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <PermitsList />
      </div>
    </div>
  )
}