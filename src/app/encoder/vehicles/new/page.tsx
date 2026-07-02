'use client'

import RoleGuard from '@/components/RoleGuard'
import VehicleRegistrationForm from '@/components/VehicleRegistrationForm'
import GradientHeader from '@/ui/GradientHeader'

export default function RegisterVehiclePage() {
  return (
    <RoleGuard allowedRoles={['DATA_ENCODER']}>
      <div className="mx-auto max-w-2xl">
        <GradientHeader
          title="Register New Vehicle"
          subtitle="Add a new vehicle to the transportation system"
          backHref="/encoder/vehicles"
          compact
        />
        <div className="-mt-6 px-4 pb-8 lg:px-8">
          <VehicleRegistrationForm />
        </div>
      </div>
    </RoleGuard>
  )
}
