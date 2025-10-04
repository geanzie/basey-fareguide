'use client'

import RoleGuard from '@/components/RoleGuard'
import VehicleRegistrationForm from '@/components/VehicleRegistrationForm'

export default function RegisterVehiclePage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <RegisterVehicleContent />
    </RoleGuard>
  )
}

function RegisterVehicleContent() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Register New Vehicle
              </h1>
              <p className="text-gray-600 mt-1">
                Add a new vehicle to the transportation system
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        <VehicleRegistrationForm />
      </div>
    </div>
  )
}