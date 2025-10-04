'use client'

import RoleGuard from '@/components/RoleGuard'
import VehiclesList from '@/components/VehiclesList'

export default function VehiclesListPage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <VehiclesListContent />
    </RoleGuard>
  )
}

function VehiclesListContent() {
  return (
    <div className="bg-gray-50 min-h-screen w-full">
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
                Vehicle Registry
              </h1>
              <p className="text-gray-600 mt-1">
                Browse and manage all registered vehicles
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-8 w-full">
        <VehiclesList />
      </div>
    </div>
  )
}